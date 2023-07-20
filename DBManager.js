const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/**
 * Manages the personnel and projects collections in a database.
 * Gonzales' code
 */
class DBManager {
    static backupDir = "./backup";

    /**
     * Constructs a new DBManager instance.
     * @param {Collection} projects - The projects collection object.
     * @param {Collection} personnel - The personnel collection object.
     */
    constructor(projects, personnel) {
        this.personnel = personnel;
        this.projects = projects;
    }

    /**
     * "Unjoins" a person and project
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
     * @returns {Promise<void>} - A promise that resolves once the operation is complete.
     */

    async unjoin(projectID, personID) {
        let projectQuery = { _id: projectID };
        let personQuery = { _id: personID };

        let person, project;
        try {
            person = await this.personnel.findOne(personQuery);
            project = await this.projects.findOne(projectQuery);

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

        // push to db
        try {
            await this.personnel.updateOne(personQuery, {
                $set: { projects: assignments },
            });
            await this.projects.updateOne(projectQuery, {
                $set: { members: members },
            });
        } catch (error) {
            console.log("ERROR: " + error);
            return;
        }
    }

    /**
     * Joins a person to a project in the database.
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
     * @returns {Promise<void>} - A promise that resolves once the join operation is complete.
     */
    async join(projectID, personID) {
        // set up the queries
        const projectQuery = { _id: projectID };
        const personQuery = { _id: personID };

        //create and load the person and project objects with queries
        let person, project;
        try {
            person = await this.personnel.findOne(personQuery);
            project = await this.projects.findOne(projectQuery);
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
            await this.personnel.updateOne(personQuery, {
                $set: { projects: person.projects },
            });
            await this.projects.updateOne(projectQuery, {
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
    async changeRole(projectID, personID, role) {
        const projectQuery = { _id: projectID };
        const personQuery = { _id: personID };

        // need to check if the person is in the project, if they aren't call the join function
        await this.join(projectID, personID);

        //create and load the person and project objects with queries
        let person, project;
        try {
            person = await this.personnel.findOne(personQuery);
            project = await this.projects.findOne(projectQuery);
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
                if (member.role === "Lead") {
                    await this.unjoin(projectID, member.id);
                    await this.join(projectID, member.id);
                }
            }
        }

        // Find index of assignment and member

        const assignmentIndex = assignments.findIndex(
            (assignment) => assignment.id === projectID
        );
        const memberIndex = members.findIndex(
            (member) => member.id === personID
        );

        // Check if assignment and member were found
        if (assignmentIndex === -1 || memberIndex === -1) {
            return;
        }

        // Update the role
        assignments[assignmentIndex].role = role;
        members[memberIndex].role = role;

        // push to database
        try {
            await this.personnel.updateOne(personQuery, {
                $set: { projects: assignments },
            });
            await this.projects.updateOne(projectQuery, {
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
    async createPerson(person) {
        //generate new ID and insert into db
        person._id = crypto.randomUUID();
        this.personnel.insertOne(person, (err, result) => {
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
    async createProject(project) {
        //generate new ID and insert into db
        project._id = crypto.randomUUID();
        this.projects.insertOne(project, (err, result) => {
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
    async deletePerson(personID) {
        const personQuery = { _id: personID };

        let person;
        try {
            person = await this.personnel.findOne(personQuery);
            if (!person) {
                console.log("Result not found");
                return;
            }
        } catch (error) {
            console.log("ERROR: " + error);
        }

        // get rid of all joins
        if (person.projects) {
            for (let assignment of person.projects) {
                await this.unjoin(assignment.id, personID);
            }
        }

        this.personnel.deleteOne(personQuery, (err, result) => {
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
    async deleteProject(projectID) {
        const projectQuery = { _id: projectID };

        let project;
        try {
            project = await this.projects.findOne(projectQuery);
            if (!project) {
                console.log("Result not found");
                return;
            }
        } catch (error) {
            console.log("ERROR: " + error);
        }

        // get rid of all joins
        for (let member of project.members) {
            await this.unjoin(projectID, member.id);
        }

        this.projects.deleteOne(projectQuery, (err, result) => {
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
    async updatePerson(personID, person) {
        const personQuery = { _id: personID };
        let { firstName, lastName } = person;

        this.personnel.updateOne(personQuery, {
            $set: { firstName, lastName },
        });
    }

    /**
     * Updates a project document in the projects collection with the specified projectID.
     * @param {string} projectID - The ID of the project document to be updated.
     * @param {Object} project - The updated project object containing the new values for name and description properties.
     * @returns {Promise<void>} - A promise that resolves once the update operation is complete.
     */
    async updateProject(projectID, project) {
        const projectQuery = { _id: projectID };
        let { name, description } = project;

        this.projects.updateOne(projectQuery, { $set: { name, description } });
    }

    async exportJSON(collection) {
        let data;
        if (collection === this.personnel || collection === this.projects) {
            data = await collection.find().toArray();
        } else {
            throw new Error(
                'Invalid collection specified. Use "personnel" or "projects".'
            );
        }

        return data;
    }

    async importJSON(collection, data) {
        // save backup because we're about to do something very dangerous
        await this.saveBackup(collection);

        // uh-oh we deleting everything
        await collection.deleteMany({});

        const jsonData = JSON.parse(data);

        await collection.insertMany(jsonData);
    }

    async saveBackup(collection) {
        let collections = [];

        // If a specific collectionName is provided, use only that collection
        if (collection) {
            collections.push(collection);
        } else {
            // If no collectionName is provided, back up both "personnel" and "projects" collections
            collections = [this.personnel, this.projects];
        }

        for (const collection of collections) {
            const collectionName = collection.collectionName;
            const data = await this.exportJSON(collection);

            const backupFileName = `${collectionName}_backup_${new Date().getTime()}.json`;

            // Create the backup directory if it doesn't exist
            if (!fs.existsSync(DBManager.backupDir)) {
                await fs.mkdirSync(DBManager.backupDir);
            }

            const backupFilePath = `${DBManager.backupDir}/${backupFileName}`;

            fs.writeFile(
                backupFilePath,
                JSON.stringify(data, null, 2),
                (err) => {
                    if (err) {
                        console.error("Backup failed:", err);
                    } else {
                        console.log(`Backup saved in: ${backupFilePath}`);
                    }
                }
            );
        }
    }

    async restoreLatestBackup(collection) {
        let collections = [];

        // If a specific collectionName is provided, use only that collection
        if (collection) {
            collections.push(collection);
        } else {
            // If no collectionName is provided, back up both "personnel" and "projects" collections
            collections = [this.personnel, this.projects];
        }

        for (let collection of collections) {
            let files = await fs.promises.readdir(DBManager.backupDir);

            files = files
                .filter((fileName) =>
                    fileName.startsWith(`${collection.collectionName}`)
                )
                .map((fileName) => ({
                    name: fileName,
                    time: fs
                        .statSync(`${DBManager.backupDir}/${fileName}`)
                        .mtime.getTime(),
                }))
                .sort((a, b) => a.time - b.time)
                .map((file) => file.name);

            if (files.length === 0) {
                console.log("No files found in backup folder");
                return;
            }

            const backup = files[files.length - 1];

            const data = await fs.readFileSync(
                path.join(DBManager.backupDir, backup),
                "utf8"
            );

            this.importJSON(collection, data);
        }
    }
}

module.exports = DBManager;
