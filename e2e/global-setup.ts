import { MongoClient } from 'mongodb';
import { E2E_MONGODB_URI } from './playwright.config';

/** Every run starts from an empty database. */
export default async function globalSetup() {
  const client = new MongoClient(E2E_MONGODB_URI);
  try {
    await client.connect();
    await client.db().dropDatabase();
  } finally {
    await client.close();
  }
}
