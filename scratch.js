const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");

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

const db = client.db("CBProjects");

const personnel = db.collection("personnel");
const projects = db.collection("projects");

async function unjoin(projectID, personID) {
    /**
     * "Unjoins" a person and project
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
     * @returns {Promise<void>} - A promise that resolves once the operation is complete.
     */
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

    if (!assignments || !members) return; // this person has no projects

    // this isn't joined
    if (
        !assignments.find((assignment) => assignment.id === projectID) ||
        !members.find((member) => member.id === personID)
    )
        return;

    assignments = assignments.filter(
        (assignment) => assignment.id !== projectID
    );
    members = members.filter((member) => member.id !== personID);

    // push to database
    try {
        await personnel.updateOne(personQuery, {
            $set: { projects: assignments },
        });
        await projects.updateOne(projectQuery, {
            $set: { members: members },
        });
    } catch (error) {
        console.log("ERROR: " + error);
    }
}

async function join(projectID, personID) {
    /**
     * Joins a person to a project in the database.
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
     * @returns {Promise<void>} - A promise that resolves once the join operation is complete.
     */
    // set up the queries
    const projectQuery = { _id: projectID };
    const personQuery = { _id: personID };

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
    const assignment = person.projects.find(
        (assignment) => assignment.id === projectID
    );
    const member = project.members.find((member) => member.id === personID);

    // if they aren't the same (member and project were improperly joined somehow)
    if ((assignment !== undefined) ^ (member !== undefined)) {
        console.log("Project and member improperly joined (?). Fixing...");
        if (!assignment) {
            const newAssignment = { id: projectID };
            if (member.role)
                // if, for some bizarre reason, the improper join has a role assigned
                newAssignment.role = member.role;
            person.projects.push(newAssignment);
        } else {
            const newMember = { id: personID };
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
        await personnel.updateOne(personQuery, {
            $set: { projects: person.projects },
        });
        await projects.updateOne(projectQuery, {
            $set: { members: project.members },
        });
    } catch (error) {
        console.log("ERROR: " + error);
    }
}

async function changeRole(projectID, personID, role) {
    const projectQuery = { _id: projectID };
    const personQuery = { _id: personID };

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

    const assignments = person.projects;
    const members = project.members;

    // THERE CAN ONLY BE ONE!
    if (role === "Lead") {
        for (let member of members) {
            if (member.role === "Lead") delete member.role;
        }
    }

    // Find index of assignment and member
    const assignmentIndex = assignments.findIndex(
        (assignment) => assignment.id === projectID
    );
    const memberIndex = members.findIndex((member) => member.id === personID);

    // Check if assignment and member were found
    if (assignmentIndex === -1 || memberIndex === -1) {
        return;
    }

    // Update the role
    assignments[assignmentIndex].role = role;
    members[memberIndex].role = role;

    // push to database
    try {
        await personnel.updateOne(personQuery, {
            $set: { projects: assignments },
        });
        await projects.updateOne(projectQuery, {
            $set: { members: members },
        });
    } catch (error) {
        console.log("ERROR: " + error);
    }
}

async function createPerson(person) {
    //generate new ID and insert into db
    person._id = crypto.randomUUID();
    personnel.insertOne(person, (err, result) => {
        if (err) {
            console.error("Failed to insert person:", err);
        }
    });
    return person._id
}

async function createProject(project) {
    //generate new ID and insert into db
    project._id = crypto.randomUUID();
    projects.insertOne(project, (err, result) => {
        if (err) {
            console.error("Failed to insert person:", err);
        }
    });
    return project._id
}

async function deletePerson(personID) {
    const personQuery = { _id: personID };

    let person;
    try {
        person = await personnel.findOne(personQuery);
        if (!person) {
            console.log("Result not found");
            return;
        }
    } catch (error) {
        console.log("ERROR: " + error);
    }

    for (assignment of person.projects) {
        unjoin(assignment.id, personID);
    }

    personnel.deleteOne(personQuery, (err, result) => {
        if (err) {
            console.error("Failed to delete person: ", err);
        }
    });
}

async function deleteProject(projectID) {
    const projectQuery = { _id: projectID };
    let project;
    try {
        project = await projects.findOne(projectQuery);
        if (!project) {
            console.log("Result not found");
            return;
        }
    } catch (error) {
        console.log("ERROR: " + error);
    }

    for (member of project.members) {
        unjoin(projectID, member.id);
    }

    projects.deleteOne(projectQuery, (err, result) => {
        if (err) {
            console.error("Failed to delete project: ", err);
        }
    });
}

async function doThing() {
    const ianID = await createPerson({ firstName: "Ian", lastName: "Gronemier" });

    const projectID = await createProject({
        name: "Kick bricks",
        description:
            "If you got this assignment that means no one wants you at the squadron",
    });

    console.log(ianID, projectID)

    await join(projectID, ianID);

    await changeRole(projectID, ianID, "Lead");

    await unjoin(projectID, ianID)

    await deletePerson(ianID);

    await deleteProject(projectID);
}

async function test() {
    let dowuh = await createPerson({firstName: "ernest", lastName: "carrasco"})
    console.log(dowuh)
}
doThing()

//test()