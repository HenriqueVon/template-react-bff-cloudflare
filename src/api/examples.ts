import { createResource } from './resource';

// The reference resource of the template. Types mirror the API; copy this module when you add a resource.
export type Example = {
  id          : string;
  name        : string;
  description : string | null;
  createdAt   : string;
  updatedAt   : string;
};

export type CreateExampleInput = {
  name         : string;
  description? : string | null;
};

export type UpdateExampleInput = Partial<CreateExampleInput>;

export const exampleResource = createResource<Example, CreateExampleInput, UpdateExampleInput>({
  key     : 'examples',
  path    : '/examples',
  orderBy : 'createdAt',
});

export const useExamplePage = exampleResource.usePage;
