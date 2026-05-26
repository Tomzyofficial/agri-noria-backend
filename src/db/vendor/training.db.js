import pool from "../../lib/connect.js";
import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";

// Training partner schedules a training session
export async function createTraining(
  vendorId,
  title,
  description,
  thumbnail,
  agoraChannelName,
  scheduledAt,
  durationMinutes,
  maxParticipants,
) {
  try {
    const result = await pool.query(
      ` INSERT INTO trainings (
          trainer_id,
          title,
          description,
          thumbnail,
          agora_channel_name,
          scheduled_at,
          duration_minutes,
          max_participants
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
      [
        vendorId,
        title,
        description,
        thumbnail,
        agoraChannelName,
        scheduledAt,
        durationMinutes,
        maxParticipants,
      ],
    );
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error("error occurred while creating trainings", error);
    return {
      success: false,
      error: "Failed to create training. Please try again.",
    };
  }
}

// Delete training session by training partner
export async function deleteTraining(trainingId, vendorId) {
  const client = await pool.connect();
  await client.query("BEGIN");

  try {
    // Check if the training exists and fetch its thumbnail
    const trainingResult = await client.query(
      `SELECT status, thumbnail FROM trainings WHERE id = $1 AND trainer_id = $2`,
      [trainingId, vendorId],
    );

    if (trainingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Training not found or unauthorized" };
    }

    const { status, thumbnail } = trainingResult.rows[0];

    // Prevent deletion of live training sessions
    if (String(status).toUpperCase() === "LIVE") {
      await client.query("ROLLBACK");
      return { success: false, error: "Cannot delete a live training session" };
    }

    // Delete the thumbnail from Cloudinary if it exists
    if (thumbnail && thumbnail.includes("cloudinary.com")) {
      const deleteResult = await deleteFileFromCloudinary(thumbnail);
      if (!deleteResult || deleteResult.result !== "ok") {
        await client.query("ROLLBACK");
        return {
          success: false,
          error: "Failed to delete thumbnail from Cloudinary",
        };
      }
    }

    // Delete the training record from the database
    const result = await client.query(
      `DELETE FROM trainings WHERE id = $1 AND trainer_id = $2 RETURNING *`,
      [trainingId, vendorId],
    );

    await client.query("COMMIT");
    return { success: true, data: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting training:", error);
    return {
      success: false,
      error: error.message || "Failed to delete training. Please try again.",
    };
  } finally {
    client.release();
  }
}

// Fetch trainings created by a specific Training partner. Count individual enrolled farmers for a training and total enrollment for a specific trainer
export async function getTrainingsByVendor(vendorId) {
  try {
    const [result, totalEnrolledFarmersResult] = await Promise.all([
      pool.query(
        `SELECT t.id, t.title, t.description, t.thumbnail, t.scheduled_at, t.duration_minutes, t.status, t.max_participants, t.agora_channel_name, COUNT(te.farmer_id) AS enrolled_count FROM trainings t LEFT JOIN training_enrollments te ON t.id = te.training_id WHERE t.trainer_id = $1 GROUP BY t.id ORDER BY t.scheduled_at DESC`,
        [vendorId],
      ),
      pool.query(
        `SELECT COUNT(te.farmer_id) AS total_enrollment FROM trainings t LEFT JOIN training_enrollments te ON t.id = te.training_id WHERE t.trainer_id = $1`,
        [vendorId],
      ),
    ]);

    const totalEnrolledFarmers =
      totalEnrolledFarmersResult.rows[0]?.total_enrollment || 0;
    const totalTrainings = result.rows.length;
    return {
      success: true,
      data: result.rows,
      total: totalTrainings,
      totalEnrolledFarmers,
    };
  } catch (error) {
    console.error("Error fetching trainings by vendor:", error);
    return {
      success: false,
      error: "Failed to fetch trainings. Please try again.",
    };
  }
}

// Count the total number of enrolled farmers for a specific trainer
export async function countEnrolledFarmersByTrainer(vendorId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(te.farmer_id) AS total_enrollment FROM trainings t LEFT JOIN training_enrollments te ON t.id = te.training_id WHERE t.trainer_id = $1`,
      [vendorId],
    );
    return { success: true, total: result.rows[0].total_enrollment };
  } catch (error) {
    console.error("Error counting enrolled farmers by trainer:", error);
    return { success: false, total: 0 };
  }
}

// Enrollments this should be farmers only
export async function enrollFarmerInTraining(trainingId, farmerId) {
  const result = await pool.query(
    `INSERT INTO training_enrollments (training_id, farmer_id) 
       VALUES ($1, $2) 
       ON CONFLICT (training_id, farmer_id) DO NOTHING 
       RETURNING *`,
    [trainingId, farmerId],
  );
  return result.rows[0];
}

// Get farmer enrollment count for a specific training. This will be used in the farmer dashboard
export async function getFarmerEnrollmentsCount(farmerId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(id) as count FROM training_enrollments WHERE farmer_id = $1`,
      [farmerId],
    );

    return { success: true, total: result.rows[0].count };
  } catch (error) {
    console.error("Error fetching farmer enrollments:", error);
    return { success: false, total: 0 };
  }
}

// Check if a farmer is enrolled in a specific training
export async function isFarmerEnrolled(trainingId, farmerId) {
  try {
    const result = await pool.query(
      `SELECT id FROM training_enrollments WHERE training_id = $1 AND farmer_id = $2`,
      [trainingId, farmerId],
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error("Error checking farmer enrollment:", error);
    return false;
  }
}

// Update training status when training starts
export async function startTraining(trainingId, trainerId) {
  try {
    const result = await pool.query(
      `UPDATE trainings
       SET status = 'LIVE', started_at = NOW()
       WHERE id = $1 AND trainer_id = $2 AND status = 'UPCOMING'
       RETURNING *`,
      [trainingId, trainerId],
    );
    if (result.rows.length === 0) {
      return {
        success: false,
        error: "Training not found, unauthorized, or not ready to start",
      };
    }
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error("Error starting training:", error);
    return {
      success: false,
      error: "Failed to start training. Please try again.",
    };
  }
}

// Update training status when training ends
export async function endTraining(trainingId, trainerId) {
  try {
    const result = await pool.query(
      `UPDATE trainings
       SET status = 'COMPLETED', ended_at = NOW()
       WHERE id = $1 AND trainer_id = $2 AND status = 'LIVE'
       RETURNING *`,
      [trainingId, trainerId],
    );
    if (result.rows.length === 0) {
      return {
        success: false,
        error: "Training not found, unauthorized, or not currently live",
      };
    }
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error("Error ending training:", error);
    return {
      success: false,
      error: "Failed to end training. Please try again.",
    };
  }
}

// Get training details with enrollment status for a farmer used to verify farmer is enrolled during session start
export async function getTrainingWithEnrollmentStatus(trainingId, farmerId) {
  try {
    const result = await pool.query(
      `SELECT t.*, v.fname AS trainer_fname, v.lname AS trainer_lname,
          CASE WHEN te.id IS NOT NULL THEN true ELSE false END AS is_enrolled
          FROM trainings t 
          LEFT JOIN vendors v ON t.trainer_id = v.id 
          LEFT JOIN training_enrollments te ON t.id = te.training_id AND te.farmer_id = $2
          WHERE t.id = $1`,
      [trainingId, farmerId],
    );

    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error("Error getting training with enrollment status:", error);
    return {
      success: false,
      error: "Failed to fetch training details. Please try again.",
    };
  }
}

// Get all trainings and enrollment with real-time status updates (farmer side)
export async function getTrainingsWithStatus() {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.description, t.thumbnail, t.scheduled_at, t.duration_minutes, t.status,
          v.fname AS trainer_fname, v.lname AS trainer_lname, te.training_id AS enrolled_training_id,
          CASE
            WHEN t.status = 'UPCOMING' AND t.scheduled_at <= NOW() THEN 'READY_TO_START'
            WHEN t.status = 'LIVE' AND t.scheduled_at + (t.duration_minutes * INTERVAL '1 minute') <= NOW() THEN 'SHOULD_END'
            ELSE t.status
          END AS computed_status
          FROM trainings t
          LEFT JOIN vendors v ON t.trainer_id = v.id
          LEFT JOIN training_enrollments te ON t.id = te.training_id
          ORDER BY t.scheduled_at ASC`,
    );

    // console.log("result", result.rows);
    return { success: true, data: result.rows, total: result.rows.length };
  } catch (error) {
    console.error("Error getting trainings with status:", error);
    return { success: false, data: [], total: 0 };
  }
}
