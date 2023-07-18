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
/**
 * "Unjoins" a person and project
 * @param {string} projectID - The ID of the project to join.
 * @param {string} personID - The ID of the person to join.
 * @returns {Promise<void>} - A promise that resolves once the operation is complete.
 */
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

/**
 * Joins a person to a project in the database.
 * @param {string} projectID - The ID of the project to join.
 * @param {string} personID - The ID of the person to join.
 * @returns {Promise<void>} - A promise that resolves once the join operation is complete.
 */
async function join(projectID, personID) {
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

/**
 * Changes the role of a person in a project by updating the person and project documents.
 * @param {string} projectID - The ID of the project where the role change occurs.
 * @param {string} personID - The ID of the person whose role is being changed.
 * @param {string} role - The new role to assign to the person.
 * @returns {Promise<void>} - A promise that resolves once the role change operation is complete.
 */
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

/**
 * Creates a new person document into the personnel collection
 * @param {string} person - The new person object to be inserted
 * @returns {Promise<void>} - A promise that resolves once the creation operation is complete.
 */
async function createPerson(person) {
    //generate new ID and insert into db
    person._id = crypto.randomUUID();
    personnel.insertOne(person, (err, result) => {
        if (err) {
            console.error("Failed to insert person:", err);
        }
    });
    return person._id;
}

/**
 * Creates a new project document into the projects collection
 * @param {string} project - The new project object to be inserted
 * @returns {Promise<void>} - A promise that resolves once the creation operation is complete.
 */
async function createProject(project) {
    //generate new ID and insert into db
    project._id = crypto.randomUUID();
    projects.insertOne(project, (err, result) => {
        if (err) {
            console.error("Failed to insert person:", err);
        }
    });
    return project._id;
}

/**
 * Deletes a person document from the personnel collection with the specified personID.
 * @param {string} personID - The ID of the person document to be deleted.
 * @returns {Promise<void>} - A promise that resolves once the deletion operation is complete.
 */
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

    // get rid of all joins
    for (assignment of person.projects) {
        unjoin(assignment.id, personID);
    }

    personnel.deleteOne(personQuery, (err, result) => {
        if (err) {
            console.error("Failed to delete person: ", err);
        }
    });
}

/**
 * Deletes a project document from the projects collection with the specified projectID.
 * @param {string} projectID - The ID of the project document to be deleted.
 * @returns {Promise<void>} - A promise that resolves once the deletion operation is complete.
 */
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

    // get rid of all joins
    for (member of project.members) {
        unjoin(projectID, member.id);
    }

    projects.deleteOne(projectQuery, (err, result) => {
        if (err) {
            console.error("Failed to delete project: ", err);
        }
    });
}

/**
 * Updates a person document in the personnel collection with the specified personID.
 * @param {string} personID - The ID of the person document to be updated.
 * @param {Object} person - The updated person object containing the new values for firstName and lastName properties.
 * @returns {Promise<void>} - A promise that resolves once the update operation is complete.
 */
async function updatePerson(personID, person) {
    const personQuery = { _id: personID };
    let { firstName, lastName } = person;

    personnel.updateOne(personQuery, { $set: { firstName, lastName } });
}

/**
 * Updates a project document in the projects collection with the specified projectID.
 * @param {string} projectID - The ID of the project document to be updated.
 * @param {Object} project - The updated project object containing the new values for name and description properties.
 * @returns {Promise<void>} - A promise that resolves once the update operation is complete.
 */
async function updateProject(projectID, project) {
    const projectQuery = { _id: projectID };
    let { name, description } = project;

    projects.updateOne(projectQuery, { $set: { name, description } });
}

async function doThing() {
    const ianID = await createPerson({
        firstName: "Ian",
        lastName: "Gronemier",
    });

    const projectID = await createProject({
        name: "Kick bricks",
        description:
            "If you got this assignment that means no one wants you at the squadron",
    });

    console.log(ianID, projectID);

    await join(projectID, ianID);

    await changeRole(projectID, ianID, "Lead");

    await unjoin(projectID, ianID);

    await deletePerson(ianID);

    await deleteProject(projectID);
}

async function test2() {
    ian = { firstName: "Ian", lastName: "Gronemeier" };
    const id = await createPerson(ian);
    ian.firstName = "Zynny";
    updatePerson(id, ian);

    ahahah = { name: "ooh", description: "ahh" };
    const projid = await createProject(ahahah);
    ahahah.name = "wuh?";
    ahahah.description = "huh?";
    updateProject(projid, ahahah);
}

test2();
