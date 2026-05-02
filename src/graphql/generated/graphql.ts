/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Mirror of planned .NET Hot Chocolate schema � front-end contract. */
  DateTime: { input: unknown; output: unknown; }
};

export type Attachment = {
  __typename?: 'Attachment';
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  uploadedAt: Scalars['DateTime']['output'];
  url: Scalars['String']['output'];
};

export type Comment = {
  __typename?: 'Comment';
  author: Maybe<User>;
  authorId: Scalars['ID']['output'];
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  ticketId: Scalars['ID']['output'];
};

export type CreateTicketInput = {
  attachmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['String']['input'];
  description: Scalars['String']['input'];
  priority: TicketPriority;
  title: Scalars['String']['input'];
};

export type DashboardMetrics = {
  __typename?: 'DashboardMetrics';
  agingOver7d: Scalars['Int']['output'];
  byTeam: Array<TeamWorkload>;
  openCount: Scalars['Int']['output'];
  resolvedCount: Scalars['Int']['output'];
  slaBreaches: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addComment: Comment;
  assignTicket: Ticket;
  createTicket: Ticket;
  updateTicket: Ticket;
};


export type MutationAddCommentArgs = {
  body: Scalars['String']['input'];
  ticketId: Scalars['ID']['input'];
};


export type MutationAssignTicketArgs = {
  assigneeId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
};


export type MutationCreateTicketArgs = {
  input: CreateTicketInput;
};


export type MutationUpdateTicketArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTicketInput;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type Query = {
  __typename?: 'Query';
  dashboardMetrics: DashboardMetrics;
  ticket: Maybe<Ticket>;
  tickets: TicketConnection;
};


export type QueryDashboardMetricsArgs = {
  range: Scalars['String']['input'];
};


export type QueryTicketArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTicketsArgs = {
  after: InputMaybe<Scalars['String']['input']>;
  filter: InputMaybe<TicketFilterInput>;
  first: InputMaybe<Scalars['Int']['input']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  ticketUpdated: Ticket;
};


export type SubscriptionTicketUpdatedArgs = {
  id: Scalars['ID']['input'];
};

export type Team = {
  __typename?: 'Team';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type TeamWorkload = {
  __typename?: 'TeamWorkload';
  openTickets: Scalars['Int']['output'];
  teamId: Scalars['ID']['output'];
  teamName: Scalars['String']['output'];
};

export type Ticket = {
  __typename?: 'Ticket';
  assignee: Maybe<User>;
  assigneeId: Maybe<Scalars['ID']['output']>;
  attachments: Array<Attachment>;
  category: Maybe<Scalars['String']['output']>;
  comments: Array<Comment>;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  history: Array<TicketHistoryEntry>;
  id: Scalars['ID']['output'];
  priority: TicketPriority;
  relatedTicketIds: Array<Scalars['ID']['output']>;
  requester: Maybe<User>;
  requesterId: Scalars['ID']['output'];
  slaBreached: Scalars['Boolean']['output'];
  slaDueAt: Maybe<Scalars['DateTime']['output']>;
  status: TicketStatus;
  tags: Array<Scalars['String']['output']>;
  team: Maybe<Team>;
  teamId: Maybe<Scalars['ID']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TicketConnection = {
  __typename?: 'TicketConnection';
  edges: Array<TicketEdge>;
  pageInfo: PageInfo;
};

export type TicketEdge = {
  __typename?: 'TicketEdge';
  cursor: Scalars['String']['output'];
  node: Ticket;
};

export type TicketFilterInput = {
  assigneeId?: InputMaybe<Scalars['ID']['input']>;
  priority?: InputMaybe<Array<TicketPriority>>;
  search?: InputMaybe<Scalars['String']['input']>;
  slaBreaching?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<Array<TicketStatus>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TicketHistoryEntry = {
  __typename?: 'TicketHistoryEntry';
  action: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  details: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
};

export type TicketPriority =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4';

export type TicketStatus =
  | 'CLOSED'
  | 'IN_PROGRESS'
  | 'OPEN'
  | 'RESOLVED';

export type UpdateTicketInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<TicketPriority>;
  status?: InputMaybe<TicketStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  role: UserRole;
};

export type UserRole =
  | 'AGENT'
  | 'MANAGER'
  | 'REQUESTER';

export type TicketsQueryVariables = Exact<{
  filter?: TicketFilterInput | null | undefined;
  after?: string | null | undefined;
  first?: number | null | undefined;
}>;


export type TicketsQuery = { tickets: { edges: Array<{ cursor: string, node: { id: string, title: string, status: TicketStatus, priority: TicketPriority, slaBreached: boolean, slaDueAt: unknown, tags: Array<string>, updatedAt: unknown, assignee: { id: string, name: string } | null, team: { id: string, name: string } | null } }>, pageInfo: { endCursor: string | null, hasNextPage: boolean } } };

export type TicketQueryVariables = Exact<{
  id: string | number;
}>;


export type TicketQuery = { ticket: { id: string, title: string, description: string, status: TicketStatus, priority: TicketPriority, assigneeId: string | null, category: string | null, slaBreached: boolean, slaDueAt: unknown, tags: Array<string>, createdAt: unknown, updatedAt: unknown, relatedTicketIds: Array<string>, assignee: { id: string, name: string, email: string } | null, requester: { id: string, name: string, email: string } | null, team: { id: string, name: string } | null, comments: Array<{ id: string, body: string, createdAt: unknown, author: { id: string, name: string } | null }>, history: Array<{ id: string, action: string, details: string | null, createdAt: unknown }>, attachments: Array<{ id: string, fileName: string, url: string, uploadedAt: unknown }> } | null };

export type DashboardMetricsQueryVariables = Exact<{
  range: string;
}>;


export type DashboardMetricsQuery = { dashboardMetrics: { openCount: number, resolvedCount: number, slaBreaches: number, agingOver7d: number, byTeam: Array<{ teamId: string, teamName: string, openTickets: number }> } };

export type CreateTicketMutationVariables = Exact<{
  input: CreateTicketInput;
}>;


export type CreateTicketMutation = { createTicket: { id: string, title: string, status: TicketStatus, priority: TicketPriority } };

export type UpdateTicketMutationVariables = Exact<{
  id: string | number;
  input: UpdateTicketInput;
}>;


export type UpdateTicketMutation = { updateTicket: { id: string, title: string, status: TicketStatus, priority: TicketPriority, updatedAt: unknown } };

export type AssignTicketMutationVariables = Exact<{
  id: string | number;
  assigneeId: string | number;
}>;


export type AssignTicketMutation = { assignTicket: { id: string, assigneeId: string | null, assignee: { id: string, name: string } | null } };

export type AddCommentMutationVariables = Exact<{
  ticketId: string | number;
  body: string;
}>;


export type AddCommentMutation = { addComment: { id: string, body: string, createdAt: unknown, author: { id: string, name: string } | null } };


export const TicketsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Tickets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TicketFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tickets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"slaBreached"}},{"kind":"Field","name":{"kind":"Name","value":"slaDueAt"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"assignee"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"team"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}}]}}]}}]} as unknown as DocumentNode<TicketsQuery, TicketsQueryVariables>;
export const TicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Ticket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ticket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"assigneeId"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"slaBreached"}},{"kind":"Field","name":{"kind":"Name","value":"slaDueAt"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"relatedTicketIds"}},{"kind":"Field","name":{"kind":"Name","value":"assignee"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"requester"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"team"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"comments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"history"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"action"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}}]}}]}}]}}]} as unknown as DocumentNode<TicketQuery, TicketQueryVariables>;
export const DashboardMetricsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DashboardMetrics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"range"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dashboardMetrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"range"},"value":{"kind":"Variable","name":{"kind":"Name","value":"range"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"openCount"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedCount"}},{"kind":"Field","name":{"kind":"Name","value":"slaBreaches"}},{"kind":"Field","name":{"kind":"Name","value":"agingOver7d"}},{"kind":"Field","name":{"kind":"Name","value":"byTeam"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"teamId"}},{"kind":"Field","name":{"kind":"Name","value":"teamName"}},{"kind":"Field","name":{"kind":"Name","value":"openTickets"}}]}}]}}]}}]} as unknown as DocumentNode<DashboardMetricsQuery, DashboardMetricsQueryVariables>;
export const CreateTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTicketInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}}]}}]}}]} as unknown as DocumentNode<CreateTicketMutation, CreateTicketMutationVariables>;
export const UpdateTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTicketInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateTicketMutation, UpdateTicketMutationVariables>;
export const AssignTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AssignTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assigneeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"assigneeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assigneeId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"assigneeId"}},{"kind":"Field","name":{"kind":"Name","value":"assignee"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<AssignTicketMutation, AssignTicketMutationVariables>;
export const AddCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"body"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}},{"kind":"Argument","name":{"kind":"Name","value":"body"},"value":{"kind":"Variable","name":{"kind":"Name","value":"body"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<AddCommentMutation, AddCommentMutationVariables>;