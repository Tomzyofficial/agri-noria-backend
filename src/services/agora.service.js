import pkg from "agora-token";
const { RtcTokenBuilder, RtcRole } = pkg;
class AgoraService {
   getAppId() {
      return process.env.AGORA_APP_ID;
   }

   getAppCertificate() {
      return process.env.AGORA_APP_CERTIFICATE;
   }

   validateConfig() {
      const appId = this.getAppId();

      const appCertificate = this.getAppCertificate();

      if (!appId || !appCertificate) {
         throw new Error("Agora credentials missing");
      }
   }

   generateRtcToken(channelName, uid, role = "publisher", expirationInSeconds = 3600) {
      try {
         this.validateConfig();

         const appId = this.getAppId();

         const appCertificate = this.getAppCertificate();

         const currentTimestamp = Math.floor(Date.now() / 1000);

         const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

         // IMPORTANT:
         // uid MUST remain identical
         // between token generation and join()

         const rtcRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

         const token = RtcTokenBuilder.buildTokenWithUserAccount(
            appId,
            appCertificate,
            channelName,
            String(uid),
            rtcRole,
            privilegeExpiredTs,
         );

         return token;
      } catch (error) {
         console.error("Agora token generation error:", error);

         throw new Error(`Token generation failed: ${error.message}`);
      }
   }

   generateChannelName(trainingId, trainerId) {
      return `training_${trainingId}_${trainerId}`;
   }
}

export default new AgoraService();
