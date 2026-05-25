import { defineCommand } from 'citty'
import { createApiClient } from '../../api/client'
import { loadCredentials, resolveApiKey, resolveBaseUrl } from '../../auth/credentials-store'
import { renderJson } from '../../render/json'
import { renderTable } from '../../render/table'
import { reportAndExit, requireApiKey } from '../../util/errors'

const VALID_STATUSES = ['dreaming', 'planning', 'visited'] as const
type GoalStatus = (typeof VALID_STATUSES)[number]

function isStatus(s: string): s is GoalStatus {
    return (VALID_STATUSES as readonly string[]).includes(s)
}

export const goalsListCommand = defineCommand({
    meta: {
        name: 'list',
        description: "List the current user's travel goals.",
    },
    args: {
        status: {
            type: 'string',
            description: `Filter by status (${VALID_STATUSES.join('|')}).`,
        },
        collection: {
            type: 'string',
            description: 'Filter by collection id.',
        },
        'trip-id': {
            type: 'string',
            description: 'Filter by linked trip id.',
        },
        json: { type: 'boolean', description: 'Output as JSON.', default: false },
    },
    async run({ args }) {
        try {
            const creds = await loadCredentials()
            const apiKey = resolveApiKey(creds)
            requireApiKey(apiKey)

            const client = createApiClient({
                baseUrl: resolveBaseUrl(creds),
                apiKey,
            })

            const query: Record<string, unknown> = {}
            if (args.status) {
                if (!isStatus(args.status)) {
                    throw new Error(`Invalid status. Choose one of: ${VALID_STATUSES.join(', ')}.`)
                }
                query.status = args.status
            }
            if (args.collection) query.collection = args.collection
            if (args['trip-id']) query.tripId = args['trip-id']

            const { data, error } = await client.GET('/v1/goals', {
                params: { query: query as never },
            })
            if (error) {
                throw new Error(`Unexpected error fetching goals: ${JSON.stringify(error)}`)
            }

            if (args.json) {
                renderJson(data)
                return
            }

            renderTable({
                columns: [
                    { header: 'ID', key: 'id', maxWidth: 26 },
                    { header: 'Name', key: 'name', maxWidth: 40 },
                    { header: 'Type', key: 'type' },
                    { header: 'Status', key: 'status' },
                    { header: 'Priority', key: 'priority' },
                ],
                rows: data?.goals ?? [],
                emptyMessage: 'No goals yet.',
            })
        } catch (err) {
            reportAndExit(err)
        }
    },
})
