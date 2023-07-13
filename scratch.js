const { MongoClient, ObjectId } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017";

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

const db = client.db("CBTest");

const personnel = db.collection("personnel");
const projects = db.collection("projects");

async function unjoin(projectID, personID) {
    let projectQuery = { _id: projectID };
    let personQuery = { _id: personID };

    let person, project;
    try {
        person = await personnel.findOne(personQuery);
        project = await projects.findOne(projectQuery);

        if (!person || !project) {
            console.log("Result not found");
            return;
        }
    } catch (error) {
        console.log("ERROR: " + error);
    }

    let assignments = person.projects;
    let members = project.members;

    let assignment = person.projects.find(
        (assignment) => assignment.id === projectID
    );
    let member = project.members.find((member) => member.id === personID);

    console.log(assignments, members);
}

async function join(projectID, personID) {
    // set up the queries
    let projectQuery = { _id: projectID };
    let personQuery = { _id: personID };

    //create and load the person and project objects with queries
    let person, project;
    try {
        person = await personnel.findOne(personQuery);
        project = await projects.findOne(projectQuery);
        if (!person || !project) {
            console.log("Result not found");
            return;
        }
    } catch (error) {
        console.log("ERROR: " + error);
    }

    // create projects and members if they don't exist
    if (!person.projects) person.projects = [];

    if (!project.members) project.members = [];

    // check if project and member are already joined
    let assignment = person.projects.find(
        (assignment) => assignment.id === projectID
    );
    let member = project.members.find((member) => member.id === personID);

    // if they aren't the same (member and project were improperly joined somehow)
    if ((assignment !== undefined) ^ (member !== undefined)) {
        console.log("Project and member improperly joined (?). Fixing...");
        if (!assignment) {
            let newAssignment = { id: projectID };
            if (member.role)
                // if, for some bizarre reason, the improper join has a role assigned
                newAssignment.role = member.role;
            person.projects.push(newAssignment);
        } else {
            let newMember = { id: personID };
            if (assignment.role) newMember.role = assignment.role;
            project.members.push(newMember);
        }
    } else if (!assignment && !member) {
        person.projects.push({ id: projectID });
        project.members.push({ id: personID });
    } else {
        // condition met when they are already joined and no change needs to be made
        return;
    }

    // finally, push to the database, updating only the projects and members arrays
    try {
        await personnel.updateOne(personQuery, { $set: {projects: person.projects }});
        await projects.updateOne(projectQuery, { $set: {members: project.members }});
    } catch (error) {
        console.log("ERROR: " + error);
    }
}

unjoin(
    "4c5a68aa-0725-4f18-b74b-89bb75c85f05",
    "0e9d1d41-7517-4916-aa5e-b654fb550169"
);
