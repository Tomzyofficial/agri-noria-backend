import pool from "../src/lib/connect.js";
import { getInputRequestsByDistributor } from "../src/db/pipeline/pipeline.db.js";

async function check() {
  try {
    const distId = '31c237c9-a1d7-4a7b-87ed-751b14978824';
    const reqs = await getInputRequestsByDistributor(distId);
    console.log(JSON.stringify(reqs, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
