const crypto = require("crypto");
const { json } = require("express");
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
     */
    async unjoin(projectID, personID) {
        let projectQuery = { _id: projectID };
        let personQuery = { _id: personID };

        let person, project;
        try {
            person = await this.personnel.findOne(personQuery);
            project = await this.projects.findOne(projectQuery);

            if (!person || !project) {
                throw new Error("Result not found");
                return;
            }
        } catch (error) {
            throw new Error("There was a problem connecting to the database.");
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
            throw new Error("There was a problem connecting to the database");
        }
    }

    /**
     * Joins a person to a project in the database.
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
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
                throw new Error("Result not found");
            }
        } catch (error) {
            throw new Error("There was a problem connecting to the database" + error);
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
            throw new Error("There was a problem connecting to the database");
        }
        console.log("hooray!")
    }

    /**
     * Changes the role of a person in a project by updating the person and project documents.
     * @param {string} projectID - The ID of the project where the role change occurs.
     * @param {string} personID - The ID of the person whose role is being changed.
     * @param {string} role - The new role to assign to the person.
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
                throw new Error("Result not found");
            }
        } catch (error) {
            throw new Error("Result not found");
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
            throw new Error("There was a problem connecting to the database");
        }
    }

    /**
     * Creates a new person document into the personnel collection
     * @param {string} person - The new person object to be inserted
     */
    async createPerson(person) {
        //generate new ID and insert into db
        person._id = crypto.randomUUID();

        this.validateData(this.personnel, [person]);

        this.personnel.insertOne(person, (err, result) => {
            if (err) {
                throw new Error("Failed to insert person");
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

        this.validateData(this.projects, [project])

        this.projects.insertOne(project, (err, result) => {
            if (err) {
                throw new Error("Failed to insert project.");
            }
        });
        return project._id;
    }

    /**
     * Deletes a person document from the personnel collection with the specified personID.
     * @param {string} personID - The ID of the person document to be deleted.
     */
    async deletePerson(personID) {
        const personQuery = { _id: personID };

        let person;
        try {
            person = await this.personnel.findOne(personQuery);
            if (!person) {
                throw new Error("Person not found");
            }
        } catch (error) {
            throw new Error("Failed to find person");
        }

        // get rid of all joins
        if (person.projects) {
            for (let assignment of person.projects) {
                await this.unjoin(assignment.id, personID);
            }
        }

        this.personnel.deleteOne(personQuery, (err, result) => {
            if (err) {
                throw new Error("Failed to delete person");
            }
        });
    }

    /**
     * Deletes a project document from the projects collection with the specified projectID.
     * @param {string} projectID - The ID of the project document to be deleted.
     */
    async deleteProject(projectID) {
        const projectQuery = { _id: projectID };

        let project;
        try {
            project = await this.projects.findOne(projectQuery);
            if (!project) {
                throw new Error("Project not found");
            }
        } catch (error) {
            throw new Error("Failed to find project");
        }

        // get rid of all joins
        for (let member of project.members) {
            await this.unjoin(projectID, member.id);
        }

        this.projects.deleteOne(projectQuery, (err, result) => {
            if (err) {
                throw new Error("Failed to delete project");
            }
        });
    }

    /**
     * Updates a person document in the personnel collection with the specified personID.
     * @param {string} personID - The ID of the person document to be updated.
     * @param {Object} person - The updated person object containing the new values for firstName and lastName properties.
     */
    async updatePerson(personID, person) {
        const personQuery = { _id: personID };

        if (!person.firstName || !person.lastName) {
            throw new Error("Person must have a first and last name.")
        }

        let { firstName, lastName } = person;

        this.personnel.updateOne(personQuery, {
            $set: { firstName, lastName },
        });
    }

    /**
     * Updates a project document in the projects collection with the specified projectID.
     * @param {string} projectID - The ID of the project document to be updated.
     * @param {Object} project - The updated project object containing the new values for name and description properties.
     */
    async updateProject(projectID, project) {
        const projectQuery = { _id: projectID };

        if (!project.name || !project.description) {
            throw new Error("Project must have name and a description.");
        }

        let { name, description } = project;

        this.projects.updateOne(projectQuery, { $set: { name, description } });
    }

    /**
     * Removes all assignments from person with matching ID
     * @param {string} personID - The ID of the person to be unassigned
     */
    async unassignPerson(personID) {
        const personQuery = { _id: personID };

        let person;
        try {
            person = await this.personnel.findOne(personQuery);
            if (!person) {
                throw new Error("Person not found");
            }
        } catch (error) {
            throw new Error("Failed to find person");
        }

        // get rid of all joins
        if (person.projects) {
            for (let assignment of person.projects) {
                await this.unjoin(assignment.id, personID);
            }
        }
    }

    /**
     * Export the data from the specified collection.
     * @param {Collection} collection - The MongoDB Collection to export data from.
     *                              Use "personnel" or "projects" for valid collections.
     * @throws {Error} If an invalid collection name is specified.
     * @returns {Array} An array containing the data exported from the collection.
     * @async
     */
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

    /**
     * Imports JSON data into the specified collection after validating its format.
     *
     * @param {Collection} collection - The MongoDB Collection where data will be imported.
     * @param {string} data - A JSON string representing the data to be imported.
     * @throws {Error} If there is an issue with saving the backup, JSON format validation, or data import.
     * @async
     */
    async importJSON(collection, data) {
        // save backup because we're about to do something very dangerous
        await this.saveBackup(collection);

        const JSONData = JSON.parse(data);

        // run validation, hopefully it errors if there is a problem
        await this.validateData(collection, JSONData);

        // uh-oh we deleting everything
        await collection.deleteMany({});

        await collection.insertMany(JSONData);
    }

    /**
     * Validates the format of JSON data for a specified collection.
     *
     * @param {Collection} collection - The MongoDB Collection where data will be imported.
     * @param {Object} data - An array representing the data to be validated.
     * @throws {Error} If there is an issue with the JSON format or data validation.
     * @async
     */
    async validateData(collection, data) {
        // this function was originally intended to validate data before importing, but we ended up using it anywhere data needed validation
        if (!Array.isArray(data)) {
            throw new Error("JSON must be an array.");
        }

        if (collection === this.personnel) {
            for (let person of data) {
                if (!person._id || typeof person._id !== "string") {
                    throw new Error(
                        "Each personnel document must have an _id field of type string."
                    );
                }
                if (!person.firstName || typeof person.firstName !== "string") {
                    throw new Error(
                        "Each personnel document must have a firstName field of type string."
                    );
                }
                if (!person.lastName || typeof person.lastName !== "string") {
                    throw new Error(
                        "Each personnel document must have a lastName field of type string."
                    );
                }
            }
        } else if (collection === this.projects) {
            for (let project of data) {
                if (!project._id || typeof project._id !== "string") {
                    throw new Error(
                        "Each project document must have an _id field of type string."
                    );
                }
                if (!project.name || typeof project.name !== "string") {
                    throw new Error(
                        "Each project document must have an name field of type string."
                    );
                }
                if (
                    !project.description ||
                    typeof project.description !== "string"
                ) {
                    throw new Error(
                        "Each project document must have an description field of type string."
                    );
                }
                if (!project.members || !Array.isArray(project.members)) {
                    throw new Error(
                        "Each project document must have an members field of type array."
                    );
                }
            }
        } else {
            throw new Error(
                "Collection must be either personnel or projects"
            );
        }
    }

    /**
     * Save a backup of the specified collection(s) in JSON format.
     *
     * @param {Collection|undefined} collection - The MongoDB Collection to back up.
     *                                            If not provided, both "personnel" and "projects" collections will be backed up.
     * @throws {Error} If there is an issue with exporting or saving the backup data.
     * @async
     */
    async saveBackup(collection) {
        let collections = [];

        // If a specific collection is provided, use only that collection
        if (collection) {
            collections.push(collection);
        } else {
            // If no collection is provided, back up both "personnel" and "projects" collections
            collections = [this.personnel, this.projects];
        }

        for (const collection of collections) {
            const collectionName = collection.collectionName;
            const data = await this.exportJSON(collection);

            // Create the backup directory if it doesn't exist
            if (!fs.existsSync(DBManager.backupDir)) {
                await fs.mkdirSync(DBManager.backupDir);
            }

            // Get the list of existing backup files for the current collection
            const backupFiles = fs
                .readdirSync(DBManager.backupDir)
                .filter((file) => file.startsWith(`${collectionName}_backup_`))
                .sort(); // Sort files in ascending order, as they contain the backup timestamp

            // If the number of backup files exceeds 5, delete the oldest one(s)
            if (backupFiles.length >= 5) {
                for (let i = 0; i < backupFiles.length - 4; i++) {
                    const oldestBackup = backupFiles[i];
                    const oldestBackupPath = `${DBManager.backupDir}/${oldestBackup}`;
                    fs.unlinkSync(oldestBackupPath);
                    console.log(
                        `Deleted the oldest backup: ${oldestBackupPath}`
                    );
                }
            }

            const backupFileName = `${collectionName}_backup_${new Date().getTime()}.json`;
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

    /**
     * Restore the latest backup for the specified collection(s) if available.
     *
     * @param {Collection|undefined} collection - The MongoDB Collection to restore the backup for.
     *                                            If not provided, the latest backup of both "personnel" and "projects" collections will be restored.
     * @throws {Error} If there is an issue with reading or importing the backup data.
     * @async
     */
    async restoreLatestBackup(collection) {
        let collections = [];

        // If a specific collection is provided, use only that collection
        if (collection) {
            collections.push(collection);
        } else {
            // If no collection is provided, back up both "personnel" and "projects" collections
            collections = [this.personnel, this.projects];
        }

        for (let collection of collections) {
            let files = await fs.promises.readdir(DBManager.backupDir);

            // for every file that starts with the right name, get the time then sort it
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

            // get the last file, grab the data and import
            const backup = files[files.length - 1];

            const data = await fs.readFileSync(
                path.join(DBManager.backupDir, backup),
                "utf8"
            );

            this.importJSON(collection, data);
        }
    }

    /**
     * Adds an account for a person identified by their unique ID.
     * If the username and password are provided, it creates an account with the specified details.
     * If the 'admin' flag is not provided, it defaults to false.
     *
     * @async
     * @param {string} personId - The unique ID of the person to whom the account will be associated.
     * @param {string} username - The username for the new account.
     * @param {string} password - The HASHED password for the new account.
     * @param {boolean} [admin=false] - (Optional) Set to true if the account should have admin privileges, false otherwise.
     * @returns {{ status: string, message: string }} A promise that resolves to an object containing the status and message.
     */
    async addAccount(personId, username, password, admin) {
        if (!(username && password)) {
            return {
                status: "error",
                message: "Account must have username and password.",
            };
        }

        if (admin === undefined) {
            admin = false;
        }

        const personQuery = { _id: personId };
        const person = await this.personnel.find(personQuery);

        if (!person) {
            return { status: "error", message: "Person not found." };
        }

        await this.personnel.updateOne(personQuery, {
            $set: { account: { username, password, admin } },
        });

        return { status: "success", message: "Account creation successful" };
    }
}

module.exports = DBManager;
