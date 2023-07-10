const { MongoClient } = require('mongodb');

async function updateProjects() {
  const uri = 'mongodb://10.10.20.64';
  const dbName = 'CBProjects';
  const collectionName = 'projects';

  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(uri, { useUnifiedTopology: true });
    const db = client.db(dbName);

    // Retrieve the projects collection
    const collection = db.collection(collectionName);

    // Update operation to set role for weight 2
    await collection.updateMany(
      { 'members.weight': 2 },
      { $set: { 'members.$[elem].role': 'Lead' } },
      { arrayFilters: [{ 'elem.weight': 2 }] }
    );

    // Update operation to remove members with weight 1
    await collection.updateMany(
      { 'members.weight': 1 },
      { $unset: { 'members.$[elem].weight': 1, 'members.$[elem].role': 1 } },
      { arrayFilters: [{ 'elem.weight': 1 }] }
    );

    console.log('Projects updated successfully.');

    // Close the MongoDB connection
    client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the function to update the projects
updateProjects();
