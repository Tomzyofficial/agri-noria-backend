const PAYSTACK_BASE_URL = "https://api.paystack.co";

async function initializePaystack(path, options = {}) {
   const { body } = options;

   try {
      const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
         method: "POST",
         body: JSON.stringify(body),
         headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
         },
      });

      if (!res.ok) {
         const errorData = await res.json().catch(() => ({}));
         throw new Error(errorData.message || "Paystack execution failed");
      }

      return await res.json();
   } catch (error) {
      console.error("Paystack Service Error:", error.message);
      throw error;
   }
}

async function verifyPaystackTransaction(reference) {
   try {
      const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
         method: "GET",
         headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
         },
      });
      return await res.json();
   } catch (error) {
      console.error("Paystack Verification Error:", error.message);
      throw error;
   }
}

export { initializePaystack, verifyPaystackTransaction };
