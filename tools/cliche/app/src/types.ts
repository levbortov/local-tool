export type Reply = {
  id: string;
  path: string;
  title: string;
  tags: string[];
  body: string;
  preview: string;
};
export type Topic = { path: string; name: string; messages: Reply[]; };
export type Library = {
  folderName: string;
  files: Topic[];
  directories: string[];
  total: number;
  skipped: string[];
};