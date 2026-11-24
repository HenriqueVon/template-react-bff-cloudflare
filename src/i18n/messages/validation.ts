import { defineMessages } from '../define-messages';

// The messages of the checks of the forms, and the names of the fields they talk about. A field comes with its article
// in Portuguese ("o nome", "a descrição"), so each sentence is built from the name of the field in both forms:
// "Informe o nome." and "O nome deve ter...".
export const validation = defineMessages({
  'en': {
    'validation.required'          : 'Enter {field}.',
    'validation.min'               : '{Field} must have at least {min} characters.',
    'validation.max'               : '{Field} must have at most {max} characters.',
    'validation.field.name'        : 'the name',
    'validation.Field.name'        : 'The name',
    'validation.field.description' : 'the description',
    'validation.Field.description' : 'The description',
  },
  'pt-BR': {
    'validation.required'          : 'Informe {field}.',
    'validation.min'               : '{Field} deve ter pelo menos {min} caracteres.',
    'validation.max'               : '{Field} deve ter no máximo {max} caracteres.',
    'validation.field.name'        : 'o nome',
    'validation.Field.name'        : 'O nome',
    'validation.field.description' : 'a descrição',
    'validation.Field.description' : 'A descrição',
  },
});
