import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { Transcript } from './database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface Definition {
  word: string;
  definition: string;
}

interface DefinitionsResponse {
  definitions: Definition[];
}

interface QuestionAnalysisResult {
  is_question: boolean;
  answer: string;
}

export const getDefinitions = async (
  sentence: string,
): Promise<DefinitionsResponse> => {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1000,
    system:
      'You are an expert on Timescale, PostgreSQL, Timescale Cloud, and TigerData Cloud products. You must identify key technical terms in sentences and provide definitions. The returned definitions should use the same casing for the words as they appear in the sentence.',
    tools: [
      {
        name: 'provide_definitions',
        description: 'Provide definitions for key terms found in the sentence',
        input_schema: {
          type: 'object',
          properties: {
            definitions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  word: {
                    description:
                      'The word or term as it appears in the sentence',
                    type: 'string',
                  },
                  definition: { type: 'string' },
                },
                required: ['word', 'definition'],
              },
            },
          },
          required: ['definitions'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'provide_definitions' },
    messages: [
      {
        role: 'user',
        content: `Analyze this sentence and identify key technical terms that would benefit from definitions. For each term, provide a concise definition. Focus on technical terms related to databases, cloud computing, data processing, or other technical concepts.\n\nSentence: ${sentence}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (content) => content.type === 'tool_use',
  );
  if (toolUse && toolUse.name === 'provide_definitions') {
    return toolUse.input as DefinitionsResponse;
  } else {
    return { definitions: [] };
  }
};

export const getQuestionAnswer = async (
  sentence: string,
): Promise<QuestionAnalysisResult> => {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1000,
    system:
      'You are an expert on PostgreSQL, Timescale, and Timescale Cloud. You can determine if a given sentence is an answerable question that pertains to PostgreSQL, Timescale, or Timescale Cloud, and provide answers only for those topics.',
    tools: [
      {
        name: 'analyze_question',
        description:
          'Analyze if the sentence is an answerable question and provide an answer if so',
        input_schema: {
          type: 'object',
          properties: {
            is_question: {
              type: 'boolean',
              description: 'Whether the sentence is an answerable question',
            },
            answer: {
              type: 'string',
              description:
                'The answer to the question if it is answerable, or empty string if not a question',
            },
          },
          required: ['is_question', 'answer'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'analyze_question' },
    messages: [
      {
        role: 'user',
        content: `Analyze this sentence and determine if it's an answerable question that relates to PostgreSQL, Timescale, or Timescale Cloud. Only answer questions about these topics. If it's not a question, not answerable, or not related to these topics, set is_question to false and answer to empty string. Keep answers extremely concise and minimal - use the fewest words possible.\n\nSentence: ${sentence}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (content) => content.type === 'tool_use',
  );
  if (toolUse && toolUse.name === 'analyze_question') {
    return toolUse.input as QuestionAnalysisResult;
  } else {
    return { is_question: false, answer: '' };
  }
};

const AnalysisObject = z.object({
  currentState: z.array(z.string()),
  businessOutcomes: z.array(z.string()),
  solutionRequirements: z.array(z.string()),
  metrics: z.array(z.string()),
});

export const getSalesAnalysis = async (transcript: Transcript[]) => {
  const response = await openai.chat.completions.parse({
    messages: [
      {
        role: 'system',
        content: `
You are analyzing a sales meeting transcript. The seller in this meeting works at Timescale, a time-series database company.

Analyze sentences from sales conversations and categorize them into one of four categories:
* currentState (current situation or problems they have with their current database)
* businessOutcomes (desired outcomes or goals they want to achieve moving to Timescale)
* solutionRequirements (technical requirements/features needed for their database solution)
* metrics (measurable goals/KPIs for their database).

For each section, provide concise bullet points. If a section has no relevant information, then leave it empty.

Keep responses concise and actionable. Focus on key insights that would help the sales team understand the deal progress.
`.trim(),
      },
      {
        role: 'user',
        content: `
Analyze this transcript and extract structured information for sales analysis.

Transcript:
${transcript.map((entry) => `${entry.speaker}: ${entry.text}`).join('\n')}
`,
      },
    ],
    model: 'gpt-4.1-nano',
    response_format: zodResponseFormat(AnalysisObject, 'sales_analysis'),
  });

  return (
    response.choices[0].message.parsed || {
      currentState: [],
      businessOutcomes: [],
      solutionRequirements: [],
      metrics: [],
    }
  );
};
