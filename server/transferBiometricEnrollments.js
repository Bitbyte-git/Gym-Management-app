const dns = require("dns");
dns.setServers(["8.8.8.8"]);

const { MongoClient } = require("mongodb");

async function transferCollection() {
  const SOURCE_URI = process.env.SOURCE_MONGODB_URI;
  const DEST_URI = process.env.DEST_MONGODB_URI;

  if (!SOURCE_URI || !DEST_URI) {
    throw new Error("Missing source or destination MongoDB URI");
  }

  const sourceClient = new MongoClient(SOURCE_URI);
  const destClient = new MongoClient(DEST_URI);

  try {
    await sourceClient.connect();
    await destClient.connect();

    const sourceDB = sourceClient.db("pulsefit-gym");
    const destDB = destClient.db("pulsefit_staging");

    const sourceCollection = sourceDB.collection("biometricenrollments");
    const destCollection = destDB.collection("biometricenrollments");

    const records = await sourceCollection.find({}).toArray();

    console.log(`Source records found: ${records.length}`);

    if (records.length === 0) {
      console.log("No records found. Nothing copied.");
      return;
    }

    const result = await destCollection.insertMany(records, {
      ordered: false,
    });

    console.log(`Successfully copied ${result.insertedCount} records.`);
  } catch (error) {
    console.error("Transfer failed:", error.message);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

transferCollection();