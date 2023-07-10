const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function hashPasswords() {
  const uri = 'mongodb://10.10.20.64';
  const dbName = 'CBProjects';
  const collectionName = 'personnel';
  const saltRounds = 10;

  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(uri, { useUnifiedTopology: true });
    const db = client.db(dbName);

    // Retrieve the personnel collection
    const collection = db.collection(collectionName);

    // Retrieve all documents in the collection
    const documents = await collection.find({}).toArray();

    // Update each document by hashing the password
    for (const document of documents) {
      if (document.account && document.account.password) {
        const hashedPassword = await bcrypt.hash(document.account.password, saltRounds);
        document.account.password = hashedPassword;

        // Update the document in the collection
        await collection.updateOne(
          { _id: document._id },
          { $set: { account: document.account } }
        );
      }
    }

    console.log('Passwords hashed successfully.');

    // Close the MongoDB connection
    client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the function to hash the passwords in the personnel collection
hashPasswords();
