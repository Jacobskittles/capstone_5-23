const { MongoClient } = require('mongodb');

async function updatePersonnel() {
  const uri = 'mongodb://10.10.20.64';
  const dbName = 'CBProjects';
  const projectsCollectionName = 'projects';
  const personnelCollectionName = 'personnel';

  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(uri, { useUnifiedTopology: true });
    const db = client.db(dbName);

    // Retrieve the projects and personnel collections
    const projectsCollection = db.collection(projectsCollectionName);
    const personnelCollection = db.collection(personnelCollectionName);

    // Retrieve all projects
    const projects = await projectsCollection.find({}).toArray();

    // Update personnel based on projects
    for (const project of projects) {
      for (const member of project.members) {
        const memberId = member.id;

        // Find the personnel document with matching member ID
        const personnel = await personnelCollection.findOne({ _id: memberId });

        if (personnel) {
          // Remove old projects attribute if exists
          if (personnel.projects) {
            personnel.projects = personnel.projects.filter(
              (p) => p.id !== project._id
            );
          }

          // Create a new project object
          const newProject = {
            id: project._id,
          };

          if (member.role === 'Lead') {
            newProject.role = 'Lead';
          }

          // Add the new project to the personnel document
          if (!personnel.projects) {
            personnel.projects = [newProject];
          } else {
            personnel.projects.push(newProject);
          }

          // Update the personnel document
          await personnelCollection.updateOne(
            { _id: memberId },
            { $set: { projects: personnel.projects } }
          );
        }
      }
    }

    console.log('Personnel updated successfully.');

    // Close the MongoDB connection
    client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the function to update the personnel collection
updatePersonnel();
