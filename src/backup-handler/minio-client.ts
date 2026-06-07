import * as Minio from "minio"
import dotenv from "dotenv"

dotenv.config()

const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || ""
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || ""
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || ""

const minIOClient = new Minio.Client({
  endPoint:MINIO_ENDPOINT,
  port:9000,
  accessKey:MINIO_ACCESS_KEY,
  secretKey:MINIO_SECRET_KEY,
  useSSL:false
})

async function pingMinIO() {
  try {
    // Attempt to list buckets as a simple connectivity check
    await minIOClient.listBuckets();
    console.log('MinIO Connected');
  } catch (err) {
    console.error('Failed to connect to MinIO:', err);
  }
}

export default minIOClient
export {
  pingMinIO
}