import swaggerAutogen from 'swagger-autogen';


const doc = {
    info:{
        title:"keep in basket",
        description:"Description"
    },
    host:"localhost:3848",
    schemes: ["http"],
    tags: [
        {
        name: "Web API",
        description: "Public-facing endpoints"
        },
        {
        name: "Admin API",
        description: "Admin panel endpoints"
        }
    ]
};

const outputFile = "./swagger-output.json";
const routes = ['./routes/web.js','./routes/admin_api.js'];
const swagger = swaggerAutogen();
swagger(outputFile,routes,doc)