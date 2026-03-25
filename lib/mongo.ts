import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 };

let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (uri) {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect().catch(err => {
        console.error('MongoDB connection failed:', err);
        global._mongoClientPromise = undefined;
        throw err;
      });
    }
    clientPromise = global._mongoClientPromise;
  } else {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect().catch(err => {
        console.error('MongoDB connection failed:', err);
        global._mongoClientPromise = undefined;
        throw err;
      });
    }
    clientPromise = global._mongoClientPromise;
  }
}

export default clientPromise;
