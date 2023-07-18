const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
const DBManager = require("./DBManager");

const uri = "mongodb://localhost:27017";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

//  This is a try/catch to ensure that the database connection is successful.
async function dbconnect() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        console.log("You have successfully connected to MongDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
    }
}
dbconnect().catch(console.dir);

const db = client.db("CBProjects");

const personnel = db.collection("personnel");
const projects = db.collection("projects");

const DBMan = new DBManager(projects, personnel);

async function doThing() {
    const ianID = await DBMan.createPerson({
        firstName: "Ian",
        lastName: "Gronemier",
    });

    const projectID = await DBMan.createProject({
        name: "Kick bricks",
        description:
            "If you got this assignment that means no one wants you at the squadron",
    });

    console.log(ianID, projectID);

    await DBMan.join(projectID, ianID);

    await DBMan.changeRole(projectID, ianID, "Lead");

    // await DBMan.unjoin(projectID, ianID);

    // await DBMan.deletePerson(ianID);

    // await DBMan.deleteProject(projectID);
}

async function test2() {
    ian = { firstName: "Ian", lastName: "Gronemeier" };
    const id = await DBMan.createPerson(ian);
    ian.firstName = "Zynny";
    DBMan.updatePerson(id, ian);

    ahahah = { name: "ooh", description: "ahh" };
    const projid = await DBMan.createProject(ahahah);
    ahahah.name = "wuh?";
    ahahah.description = "huh?";
    DBMan.updateProject(projid, ahahah);
}

doThing();