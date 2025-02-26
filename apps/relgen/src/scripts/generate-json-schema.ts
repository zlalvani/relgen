import { zodToJsonSchema } from 'zod-to-json-schema';
import { configSchema } from '../config/schema';

const jsonSchema = zodToJsonSchema(configSchema);

console.log(JSON.stringify(jsonSchema, null, 2));
