const { MongoClient, ObjectId } = require('mongodb');

const uri = "mongodb://localhost:27017";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

//  This is a try/catch to ensure that the database connection is successful. 
async function dbconnect() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    console.log('You have successfully connected to MongDB');
  } catch (error) {
    console.error("Error connecting to MongoDB", error)
  }
}
dbconnect().catch(console.dir);

const db = client.db("CBProjects")

const personnel = db.collection("personnel")
const projects = db.collection("projects")

async function join(projectID, personID) {
  let projectQuery = { _id: projectID };
  let personQuery = { _id: personID };
  
  try {
    const person = await personnel.findOne(personQuery);
    if (person) {
      console.log(person);
    } else {
      console.log("no result found");
    }
  } catch (error) {
    console.log("ERROR: " + error);
  }
}


join("d506edfb-737a-4681-be14-688d82770d76", "4c5a68aa-0725-4f18-b74b-89bb75c85f05")