import pool from "../../lib/connect.js";
import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";

// Training partner schedules a training session
export async function createTraining(
  trainerId,
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
      ` INSERT INTO trainings (trainer_id, title, description, thumbnail, agora_channel_name,
         scheduled_at, duration_minutes, max_participants) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
      [
        trainerId,
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
export async function deleteTraining(trainingId, trainerId) {
  const client = await pool.connect();
  await client.query("BEGIN");

  try {
    // Check if the training exists and fetch its thumbnail
    const trainingResult = await client.query(
      `SELECT status, thumbnail FROM trainings WHERE id = $1 AND trainer_id = $2`,
      [trainingId, trainerId],
    );

    if (trainingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Training not found or unauthorized" };
    }

    const { status, thumbnail } = trainingResult.rows[0];

    // Prevent deletion of live training sessions
    if (status === "Live") {
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
      [trainingId, trainerId],
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

// Fetch trainings created by a specific Training partner. Count individual enrolled for a training and total enrollment for a specific trainer
export async function getTrainingsByVendor(trainerId) {
  try {
    const [result, totalEnrolledFarmersResult] = await Promise.all([
      pool.query(
        `SELECT t.id, t.title, t.description, t.thumbnail, t.scheduled_at, t.duration_minutes, t.status, t.max_participants, t.agora_channel_name, COUNT(te.training_id) AS enrolled_count FROM trainings t LEFT JOIN training_enrollments te ON t.id = te.training_id WHERE t.trainer_id = $1 GROUP BY t.id ORDER BY t.scheduled_at DESC`,
        [trainerId],
      ),
      pool.query(
        `SELECT COUNT(te.trainee_id) AS total_enrollment FROM trainings t LEFT JOIN training_enrollments te ON t.id = te.training_id WHERE t.trainer_id = $1`,
        [trainerId],
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
/* export async function countEnrolledFarmersByTrainer(trainerId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(te.trainee_id) AS total_enrollment FROM trainings t LEFT JOIN training_enrollments te ON t.id = te.training_id WHERE t.trainer_id = $1`,
      [trainerId],
    );
    return { success: true, total: result.rows[0].total_enrollment };
  } catch (error) {
    console.error("Error counting enrolled farmers by trainer:", error);
    return { success: false, total: 0 };
  }
} */

// Enrollments this should be trainees only
export async function enrollFarmerInTraining(trainingId, traineeId) {
  const result = await pool.query(
    `INSERT INTO training_enrollments (training_id, trainee_id) 
       VALUES ($1, $2) 
       ON CONFLICT (training_id, trainee_id) DO NOTHING 
       RETURNING *`,
    [trainingId, traineeId],
  );
  return result.rows[0];
}

// Get farmer enrollment count for a specific training. This will be used in the farmer dashboard
export async function getFarmerEnrollmentsCount(traineeId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(id) as count FROM training_enrollments WHERE trainee_id = $1`,
      [traineeId],
    );

    return { success: true, total: result.rows[0].count };
  } catch (error) {
    console.error("Error fetching farmer enrollments:", error);
    return { success: false, total: 0 };
  }
}

// Check if a farmer is enrolled in a specific training
export async function isFarmerEnrolled(trainingId, traineeId) {
  try {
    const result = await pool.query(
      `SELECT id FROM training_enrollments WHERE training_id = $1 AND trainee_id = $2`,
      [trainingId, traineeId],
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
      `UPDATE trainings SET status = 'Live', started_at = NOW() WHERE id = $1 AND trainer_id = $2 AND status = 'Upcoming' RETURNING *`,
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
      `UPDATE trainings SET status = 'Completed', ended_at = NOW() WHERE id = $1 AND trainer_id = $2 AND status = 'Live' RETURNING *`,
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
export async function getTrainingWithEnrollmentStatus(trainingId, traineeId) {
  try {
    const result = await pool.query(
      `SELECT t.*, v.fname AS trainer_fname, v.lname AS trainer_lname,
          CASE WHEN te.id IS NOT NULL THEN true ELSE false END AS is_enrolled
          FROM trainings t 
          LEFT JOIN vendors v ON t.trainer_id = v.id 
          LEFT JOIN training_enrollments te ON t.id = te.training_id AND te.trainee_id = $2
          WHERE t.id = $1`,
      [trainingId, traineeId],
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
export async function getTrainingsWithStatus(trainee_id) {
  try {
    //  const result = await pool.query(
    //    `SELECT t.id, t.title, t.description, t.thumbnail, t.scheduled_at, t.duration_minutes, t.status,
    //        v.fname AS trainer_fname, v.lname AS trainer_lname, te.training_id AS enrolled_training_id,
    //        CASE
    //          WHEN t.status = 'Upcoming' AND t.scheduled_at <= NOW() THEN 'READY_TO_START'
    //          WHEN t.status = 'Live' AND t.scheduled_at + (t.duration_minutes * INTERVAL '1 minute') <= NOW() THEN 'SHOULD_END'
    //          ELSE t.status
    //        END AS computed_status
    //        FROM trainings t
    //       JOIN vendors v ON t.trainer_id = v.id
    //       JOIN training_enrollments te ON t.id = te.training_id
    //        ORDER BY t.scheduled_at ASC`
    //  );

    const trainingDataQuery = `SELECT t.id, t.title, t.description, t.thumbnail, t.scheduled_at, t.duration_minutes, t.status, v.fname AS trainer_fname, v.lname AS trainer_lname,
   CASE WHEN t.status = 'Upcoming' AND t.scheduled_at <= NOW() THEN 'Ready to start'
    WHEN t.status = 'Live' AND t.scheduled_at + (t.duration_minutes * INTERVAL '1 minute') <= NOW() THEN 'Ending soon' ELSE t.status END AS computed_status
    FROM trainings t LEFT JOIN vendors v ON t.trainer_id = v.id`;

    const enrollmentDataQuery = `SELECT te.training_id, te.trainee_id, t.id FROM  training_enrollments te LEFT JOIN trainings t ON t.id = te.training_id WHERE te.trainee_id = $1`;

    const [trainingDataResult, enrollmentDataResult] = await Promise.all([
      pool.query(trainingDataQuery),
      pool.query(enrollmentDataQuery, [trainee_id]),
    ]);
    return {
      success: true,
      trainingData: trainingDataResult.rows,
      enrollmentData: enrollmentDataResult.rows,
    };
  } catch (error) {
    console.error("Error getting trainings with status:", error);
    return { success: false, data: [], total: 0 };
  }
}
