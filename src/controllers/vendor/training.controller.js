import {
  createTraining,
  deleteTraining,
  getTrainingsByVendor,
  enrollFarmerInTraining,
  countEnrolledFarmersByTrainer,
  getFarmerEnrollmentsCount,
  isFarmerEnrolled,
  startTraining,
  endTraining,
  getTrainingWithEnrollmentStatus,
  getTrainingsWithStatus,
} from "../../db/vendor/training.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import agoraService from "../../services/agora.service.js";
import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";

const trainingController = {};

const createAgoraUid = (role, vendorId) => {
  const idPrefix = String(vendorId).replace(/-/g, "").slice(0, 10);
  const nonce = Math.random().toString(36).slice(2, 8);

  return `${role}_${idPrefix}_${Date.now()}_${nonce}`;
};

trainingController.createTraining = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const channelName = `training_${Date.now()}`;
  try {
    const {
      title,
      description,
      scheduledAt,
      durationMinutes,
      maxParticipants,
    } = req.body;
    const thumbnail = req.file;

    if (
      !thumbnail ||
      !title ||
      !description ||
      !scheduledAt ||
      !durationMinutes ||
      !maxParticipants
    ) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    // const thumbnailSaveToCloud = await saveImageToCloudinary(thumbnail.name, "training_thumbnails");
    const thumbnailSaveToCloud = await saveFileToCloudinary(
      thumbnail,
      "training_thumbnails",
      "image",
    );
    if (!thumbnailSaveToCloud) {
      return res.status(500).json({
        success: false,
        error: "Failed to upload thumbnail",
      });
    }

    const training = await createTraining(
      payload.id,
      title,
      description,
      thumbnailSaveToCloud.secure_url,
      channelName,
      scheduledAt,
      durationMinutes,
      maxParticipants,
    );
    return res.status(201).json({
      success: true,
      data: training,
    });
  } catch (error) {
    console.error("Error creating training:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

trainingController.deleteTraining = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
  try {
    const { trainingId } = req.params;
    const deletedTraining = await deleteTraining(trainingId, payload.id);
    if (!deletedTraining.success) {
      return res.status(400).json(deletedTraining);
    }
    return res.status(200).json({
      success: true,
      data: deletedTraining.data,
    });
  } catch (error) {
    console.error("Error deleting training:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete training",
    });
  }
};

trainingController.getTrainingsByVendor = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
  try {
    const trainings = await getTrainingsByVendor(payload.id);
    return res.status(200).json({
      success: true,
      data: trainings.data,
      total: trainings.total,
      totalEnrolledFarmers: trainings.totalEnrolledFarmers,
    });
  } catch (error) {
    console.error("Error fetching trainings:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
    });
  }
};

// trainingController.countEnrolledFarmersByTrainer = async (req, res) => {
//   const payload = await verifyVendorToken(req);
//   if (!payload) {
//     return res.status(401).json({
//       success: false,
//       error: "Unauthorized",
//     });
//   }
//   try {
//     const enrollmentCount = await countEnrolledFarmersByTrainer(payload.id);
//     return res.status(200).json({
//       success: true,
//       total: enrollmentCount.total,
//     });
//   } catch (error) {
//     console.error("Error counting enrolled farmers:", error);
//     return res.status(500).json({
//       success: false,
//       error: error.message || "Internal server error. Try again later.",
//     });
//   }
// };

trainingController.enrollFarmerInTraining = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Verify the vendor is a Farmer (not Training_Partner)
    if (payload.role !== "farmer") {
      return res.status(403).json({
        success: false,
        error: "Only Farmers can enroll in trainings",
      });
    }

    const { trainingId } = req.params;

    const enrollment = await enrollFarmerInTraining(trainingId, payload.id);

    return res.status(201).json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error("Error enrolling in training:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to enroll in training",
    });
  }
};

trainingController.getFarmerEnrollmentsCount = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }
    const enrollments = await getFarmerEnrollmentsCount(payload.id);
    return res.status(200).json({
      success: true,
      total: enrollments.total,
    });
  } catch (error) {
    console.error("Error fetching farmer enrollments:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error. Try again later.",
    });
  }
};

trainingController.startTraining = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (payload.role !== "trainer") {
      return res.status(403).json({
        success: false,
        error: "Only Training Partners can start training sessions",
      });
    }

    const { trainingId } = req.params;

    const trainingResult = await getTrainingWithEnrollmentStatus(
      trainingId,
      null,
    );
    if (!trainingResult.success) {
      return res.status(500).json(trainingResult);
    }

    const training = trainingResult.data;
    if (!training || String(training.trainer_id) !== String(payload.id)) {
      return res.status(404).json({
        success: false,
        error: "Training not found or access denied",
      });
    }

    const status = String(training.status).toUpperCase();
    let updatedTraining = training;

    if (status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        error: "Training session has already ended",
      });
    }

    if (status !== "LIVE") {
      const updatedTrainingResult = await startTraining(trainingId, payload.id);
      if (!updatedTrainingResult.success) {
        return res.status(400).json(updatedTrainingResult);
      }

      updatedTraining = updatedTrainingResult.data;
    }

    const uid = createAgoraUid("trainer", payload.id);

    const agoraToken = agoraService.generateRtcToken(
      updatedTraining.agora_channel_name,
      uid,
      "publisher",
      7200,
    );

    return res.status(200).json({
      success: true,
      data: {
        training: updatedTraining,
        agoraToken,
        channelName: updatedTraining.agora_channel_name,
        appId: agoraService.getAppId(),
        uid,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to start training",
    });
  }
};

// End training session (Training Partner only)
trainingController.endTraining = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Verify the vendor is a Training Partner
    if (payload.role !== "trainer") {
      return res.status(403).json({
        success: false,
        error: "Only Training Partners can end training sessions",
      });
    }

    const { trainingId } = req.params;

    // End the training
    const updatedTraining = await endTraining(trainingId, payload.id);
    if (!updatedTraining.success) {
      return res.status(400).json(updatedTraining);
    }

    return res.status(200).json({
      success: true,
      data: updatedTraining.data,
    });
  } catch (error) {
    console.error("Error ending training:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to end training",
    });
  }
};

trainingController.joinTraining = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (payload.role !== "farmer") {
      return res.status(403).json({
        success: false,
        error: "Only Farmers can join training sessions",
      });
    }

    const { trainingId } = req.params;

    const enrolled = await isFarmerEnrolled(trainingId, payload.id);

    if (!enrolled) {
      return res.status(403).json({
        success: false,
        error: "You must be enrolled to join this training",
      });
    }

    const trainingResult = await getTrainingWithEnrollmentStatus(
      trainingId,
      payload.id,
    );

    if (!trainingResult.success) {
      return res.status(500).json(trainingResult);
    }

    const training = trainingResult.data;
    if (!training || training.status !== "LIVE") {
      return res.status(400).json({
        success: false,
        error: "Training is not currently live",
      });
    }

    const uid = createAgoraUid("farmer", payload.id);

    const agoraToken = agoraService.generateRtcToken(
      training.agora_channel_name,
      uid,
      "publisher",
      7200,
    );

    return res.status(200).json({
      success: true,
      data: {
        training,
        agoraToken,
        channelName: training.agora_channel_name,
        appId: agoraService.getAppId(),
        uid,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to join training",
    });
  }
};

// Get trainings with real-time status updates
trainingController.getTrainingsWithStatus = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const trainings = await getTrainingsWithStatus();
    return res.status(200).json({
      success: true,
      data: trainings.data,
      total: trainings.total,
    });
  } catch (error) {
    console.error("Error getting trainings with status:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get trainings",
    });
  }
};

export default trainingController;
