import { writeFile } from 'node:fs/promises';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { configSchema } from '../config/schema';

const jsonSchema = zodToJsonSchema(configSchema);

await writeFile(
  '../../relgen-config-schema.json',
  JSON.stringify(jsonSchema, null, 2)
);
