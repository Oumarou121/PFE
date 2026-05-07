export interface SchemaTable {
  name: string;
  [key: string]: any;
}

export interface SchemaColumn {
  table: string;
  name: string;
  key?: string;
  type?: string;
  [key: string]: any;
}

export interface SchemaRelation {
  [key: string]: any;
}

export interface DatabaseSchema {
  tables?: SchemaTable[];
  columns?: SchemaColumn[];
  relations?: SchemaRelation[];
}

export interface SchemaResponse {
  schema?: DatabaseSchema;
}
