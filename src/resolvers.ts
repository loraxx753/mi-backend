const exampleRecord = {
  title: 'foobar',
  description: 'Sample data returned from the GraphQL server.',
  tags: ['foo', 'bar', 'bizz'],
  isActive: true,
  metadata: {
    owner: 'backend-demo',
    createdAt: '2026-03-27',
  },
};

export const resolvers = {
  Query: {
    example: () => exampleRecord,
    searchExamples: (_: unknown, { query }: { query?: string }) => {
      const search = query?.trim().toLowerCase();

      if (!search) {
        return exampleRecord.tags;
      }

      return exampleRecord.tags.filter((item) => item.includes(search));
    },
  },
};
