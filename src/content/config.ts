import { defineCollection, z } from 'astro:content';

const writings = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    type: z.string().optional(),
    date: z.string(),
    excerpt: z.string().optional(),
    link: z.string().url().optional(),
  }),
});

export const collections = { writings };
