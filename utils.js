module.exports = {
    countProjects: function (person) {
        let total = 0;
        person.projects.forEach(function (project) {
            if (project.weight) {
                total += project.weight;
            } else {
                total += 1;
                if (project.role == "lead") {
                    total += 1;
                }
            }
        });
        return total;
    },

    getColor: function (total) {
        let color;

        switch (total) {
            case 0:
                color = "primary";
                break;
            case 1:
                color = "success";
                break;
            case 2:
                color = "warning";
                break;
            default:
                color = "danger";
                break;
        }
        return color;
    },
    sortPersonnelByWeight: function (personnel) {
        personnel.sort((a, b) => {
            const countA = this.countProjects(a);
            const countB = this.countProjects(b);

            if (countA < countB) {
                return -1;
            }
            if (countA > countB) {
                return 1;
            }
            return 0;
        });
    },
};
