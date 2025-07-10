import swaggerAutogen from 'swagger-autogen';


const doc = {
    info:{
        title:"keep in basket",
        description:"Description"
    },
    host:"localhost:3848"
};

const outputFile = "./swagger-output.json";
const routes = ['./routes/web.js'];
const swagger = swaggerAutogen();
swagger(outputFile,routes,doc)