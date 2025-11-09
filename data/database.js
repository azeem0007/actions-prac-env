import { MongoClient } from 'mongodb';

// Read connection details from environment variables. If any are missing
// we fall back to a lightweight in-memory mock database to make local
// testing possible without an actual MongoDB instance.
const clusterAddress = process.env.MONGODB_CLUSTER_ADDRESS;
const dbUser = process.env.MONGODB_USERNAME;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbName = process.env.MONGODB_DB_NAME;

let database;

if (!clusterAddress || !dbUser || !dbPassword || !dbName) {
  console.log('MongoDB env vars not set — using in-memory fallback database');
  const events = [];
  database = {
    collection: (name) => {
      if (name !== 'events') {
        // Minimal behavior: only 'events' collection is supported by the app.
        return {
          find: () => ({ toArray: async () => [] }),
          insertOne: async (doc) => ({ insertedId: null }),
        };
      }
      return {
        find: () => ({ toArray: async () => events }),
        insertOne: async (doc) => {
          // simple incremental id for mock
          const id = (events.length + 1).toString();
          const newDoc = { ...doc, _id: id };
          events.push(newDoc);
          return { insertedId: id };
        },
      };
    },
  };
} else {
  const uri = `mongodb+srv://${dbUser}:${dbPassword}@${clusterAddress}/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri);

  console.log('Trying to connect to db');

  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    console.log('Connected successfully to server');
    database = client.db(dbName);
  } catch (error) {
    console.log('Connection failed. Falling back to in-memory db.', error);
    await client.close();
    const events = [];
    database = {
      collection: (name) => {
        return {
          find: () => ({ toArray: async () => events }),
          insertOne: async (doc) => {
            const id = (events.length + 1).toString();
            const newDoc = { ...doc, _id: id };
            events.push(newDoc);
            return { insertedId: id };
          },
        };
      },
    };
  }
}

export default database;
