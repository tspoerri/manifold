import { useEffect, useId, useRef } from 'react'
import { RealtimeChannel } from '@supabase/realtime-js'
import { TableName, Row } from 'common/supabase/utils'
import {
  Change,
  Event,
  Filter,
  SubscriptionStatus,
  buildFilterString,
} from 'common/supabase/realtime'
import { useIsPageVisible } from 'web/hooks/use-page-visible'
import { db } from 'web/lib/supabase/db'

export function useRealtimeChannel<T extends TableName, E extends Event>(
  event: E,
  table: T,
  filter: Filter<T> | null | undefined,
  onChange: (change: Change<T, E>) => void,
  onStatus?: (status: SubscriptionStatus, err?: Error) => void,
  onEnabled?: (enabled: boolean) => void,
  manualFilterString?: string
) {
  const filterString = filter
    ? buildFilterString(filter)
    : manualFilterString ?? undefined
  const channelId = `${table}-${useId()}`
  const channel = useRef<RealtimeChannel | undefined>()
  const isVisible = useIsPageVisible()

  useEffect(() => {
    if (isVisible) {
      onEnabled?.(true)
      const opts = {
        event,
        schema: 'public',
        table,
        filter: filterString,
      } as const
      const chan = (channel.current = db.channel(channelId))
      chan
        .on<Row<T>>('postgres_changes', opts as any, (change) => {
          // if we got this change over a channel we have recycled, ignore it
          if (channel.current === chan) {
            onChange(change as any)
          }
        })
        .subscribe((status, err) => {
          if (onStatus != null) {
            onStatus(status, err)
          } else {
            if (err != null) {
              console.error(err)
            }
          }
        })
      return () => {
        onEnabled?.(false)
        db.removeChannel(chan)
        channel.current = undefined
      }
    }
  }, [table, filterString, isVisible])

  return channel
}
