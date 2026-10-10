import { confirmInputDelivery } from '../src/db/pipeline/pipeline.db.js';

async function test() {
   try {
      const res = await confirmInputDelivery('be6466bd-fe0c-4304-b7bf-4b7f74dfba9b', 'test-user');
      console.log('CONFIRM RESULT:', res);
   } catch(e) {
      console.error('CONFIRM ERROR:', e);
   } finally {
      process.exit(0);
   }
}

test();
