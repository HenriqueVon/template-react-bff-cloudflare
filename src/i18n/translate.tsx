import { Fragment, type ReactNode } from 'react';

export type Params = Record<string, string | number>;

// "Excluir {name}?" with { name: 'Luz' } becomes "Excluir Luz?". A placeholder that has no value stays as it is, so a
// missing parameter is visible instead of silently empty.
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

// The same, for a text that holds elements, such as a name in bold: the template is cut at the placeholders and
// each one is replaced by its node. The parts are keyed by their position, which never changes for a template.
export function interpolateNodes(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{name !== undefined && name in nodes ? nodes[name] : part}</Fragment>;
  });
}
