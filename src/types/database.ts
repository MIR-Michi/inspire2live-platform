export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          initiative_id: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          initiative_id?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          initiative_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "activity_log_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "activity_log_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
        ]
      }
      campus_members: {
        Row: {
          country: string | null
          created_at: string
          date_welcomed: string | null
          id: string
          initiative_affiliations: string[] | null
          last_channel_activity: string | null
          name: string
          notes: string | null
          organisation: string | null
          platform_profile_id: string | null
          role_description: string | null
          updated_at: string
          welcomed_by_peter: boolean
          whatsapp_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          date_welcomed?: string | null
          id?: string
          initiative_affiliations?: string[] | null
          last_channel_activity?: string | null
          name: string
          notes?: string | null
          organisation?: string | null
          platform_profile_id?: string | null
          role_description?: string | null
          updated_at?: string
          welcomed_by_peter?: boolean
          whatsapp_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          date_welcomed?: string | null
          id?: string
          initiative_affiliations?: string[] | null
          last_channel_activity?: string | null
          name?: string
          notes?: string | null
          organisation?: string | null
          platform_profile_id?: string | null
          role_description?: string | null
          updated_at?: string
          welcomed_by_peter?: boolean
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_members_platform_profile_id_fkey"
            columns: ["platform_profile_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "campus_members_platform_profile_id_fkey"
            columns: ["platform_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_members_platform_profile_id_fkey"
            columns: ["platform_profile_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      campus_sessions: {
        Row: {
          action_items_for_publication: string[] | null
          created_at: string
          created_by: string | null
          decisions_for_publication: string[] | null
          id: string
          initiative_ids: string[] | null
          participating_hub_ids: string[] | null
          published_outputs: string[] | null
          recording_url: string | null
          session_date: string
          slides_media_id: string | null
          summary: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          action_items_for_publication?: string[] | null
          created_at?: string
          created_by?: string | null
          decisions_for_publication?: string[] | null
          id?: string
          initiative_ids?: string[] | null
          participating_hub_ids?: string[] | null
          published_outputs?: string[] | null
          recording_url?: string | null
          session_date: string
          slides_media_id?: string | null
          summary?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          action_items_for_publication?: string[] | null
          created_at?: string
          created_by?: string | null
          decisions_for_publication?: string[] | null
          id?: string
          initiative_ids?: string[] | null
          participating_hub_ids?: string[] | null
          published_outputs?: string[] | null
          recording_url?: string | null
          session_date?: string
          slides_media_id?: string | null
          summary?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "campus_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "campus_sessions_slides_media_id_fkey"
            columns: ["slides_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          attached_media_refs: string[]
          author_id: string | null
          body_draft: string | null
          channels: string[]
          created_at: string
          id: string
          published_at: string | null
          scheduled_at: string | null
          source_event_id: string | null
          source_initiative_id: string | null
          source_intake_id: string | null
          source_link: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          whatsapp_groups: string[]
        }
        Insert: {
          attached_media_refs?: string[]
          author_id?: string | null
          body_draft?: string | null
          channels: string[]
          created_at?: string
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          source_event_id?: string | null
          source_initiative_id?: string | null
          source_intake_id?: string | null
          source_link?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          whatsapp_groups?: string[]
        }
        Update: {
          attached_media_refs?: string[]
          author_id?: string | null
          body_draft?: string | null
          channels?: string[]
          created_at?: string
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          source_event_id?: string | null
          source_initiative_id?: string | null
          source_intake_id?: string | null
          source_link?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          whatsapp_groups?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_calendar_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "content_calendar_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_source_initiative_id_fkey"
            columns: ["source_initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "content_calendar_source_initiative_id_fkey"
            columns: ["source_initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_source_initiative_id_fkey"
            columns: ["source_initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_source_initiative_id_fkey"
            columns: ["source_initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "content_calendar_source_intake_id_fkey"
            columns: ["source_intake_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_digest_runs: {
        Row: {
          digest_date: string
          error_message: string | null
          id: string
          item_count: number
          recipient_email: string
          recipient_id: string | null
          send_time: string
          sent_at: string
          status: string
          timezone: string
        }
        Insert: {
          digest_date: string
          error_message?: string | null
          id?: string
          item_count?: number
          recipient_email: string
          recipient_id?: string | null
          send_time: string
          sent_at?: string
          status: string
          timezone?: string
        }
        Update: {
          digest_date?: string
          error_message?: string | null
          id?: string
          item_count?: number
          recipient_email?: string
          recipient_id?: string | null
          send_time?: string
          sent_at?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_digest_runs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comms_digest_runs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_digest_runs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      comms_integration_intents: {
        Row: {
          action_name: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          integration_target: string
          payload: Json
          requested_by: string
        }
        Insert: {
          action_name: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          integration_target: string
          payload?: Json
          requested_by: string
        }
        Update: {
          action_name?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          integration_target?: string
          payload?: Json
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_integration_intents_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comms_integration_intents_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_integration_intents_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      congress_decisions: {
        Row: {
          id: string
          title: string
          body: string | null
          description: string | null
          event_id: string | null
          congress_year: number | null
          session_id: string | null
          initiative_id: string | null
          owner_id: string | null
          deadline: string | null
          conversion_status: string
          converted_task_id: string | null
          captured_at: string
          carryover_to_event_id: string | null
          theme_id: string | null
        }
        Insert: {
          id?: string
          title: string
          body?: string | null
          description?: string | null
          event_id?: string | null
          congress_year?: number | null
          session_id?: string | null
          initiative_id?: string | null
          owner_id?: string | null
          deadline?: string | null
          conversion_status?: string
          converted_task_id?: string | null
          captured_at?: string
          carryover_to_event_id?: string | null
          theme_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          body?: string | null
          description?: string | null
          event_id?: string | null
          congress_year?: number | null
          session_id?: string | null
          initiative_id?: string | null
          owner_id?: string | null
          deadline?: string | null
          conversion_status?: string
          converted_task_id?: string | null
          captured_at?: string
          carryover_to_event_id?: string | null
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "congress_decisions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "congress_decisions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_decisions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_decisions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "congress_decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "congress_decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "congress_decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "congress_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_congress_decisions_task"
            columns: ["converted_to_task_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "fk_congress_decisions_task"
            columns: ["converted_to_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_events: {
        Row: {
          id: string
          year: number
          title: string
          description: string | null
          location: string | null
          start_date: string | null
          end_date: string | null
          theme_headline: string | null
          status: string
          parent_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          year: number
          title: string
          description?: string | null
          location?: string | null
          start_date?: string | null
          end_date?: string | null
          theme_headline?: string | null
          status?: string
          parent_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          year?: number
          title?: string
          description?: string | null
          location?: string | null
          start_date?: string | null
          end_date?: string | null
          theme_headline?: string | null
          status?: string
          parent_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "congress_events"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_themes: {
        Row: {
          id: string
          title: string
          description: string | null
          color: string
          first_year: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          color?: string
          first_year: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          color?: string
          first_year?: number
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          end_date: string | null
          attendance_kind: string
          event_type: string
          event_image_url: string | null
          event_website_url: string | null
          i2l_representatives: string[] | null
          id: string
          initiative_ids: string[] | null
          is_annual_congress: boolean
          is_i2l_organised: boolean
          location_city: string | null
          location_country: string | null
          name: string
          notes: string | null
          organiser: string | null
          output_linkedin_published: boolean
          output_media_stored: boolean
          output_newsletter_mentioned: boolean
          output_report_drafted: boolean
          podcast_backup_completed: boolean
          podcast_brief_ready: boolean
          podcast_distribution_channels: string[]
          podcast_edit_completed: boolean
          podcast_episode_title: string | null
          podcast_equipment_ready: boolean
          podcast_followup_completed: boolean
          podcast_followup_notes: string | null
          podcast_guest_confirmed: boolean
          podcast_guests: string[]
          podcast_hosts: string[]
          podcast_preparation_notes: string | null
          podcast_published: boolean
          podcast_recording_completed: boolean
          podcast_recording_link: string | null
          podcast_recording_mode: string
          podcast_release_form_ready: boolean
          podcast_run_of_show: string | null
          podcast_series_name: string | null
          podcast_show_notes_completed: boolean
          podcast_transcript_completed: boolean
          presentation_asset_url: string | null
          presentation_summary: string | null
          push_to_group_calendar: boolean
          stage: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          attendance_kind?: string
          event_type: string
          event_image_url?: string | null
          event_website_url?: string | null
          i2l_representatives?: string[] | null
          id?: string
          initiative_ids?: string[] | null
          is_annual_congress?: boolean
          is_i2l_organised?: boolean
          location_city?: string | null
          location_country?: string | null
          name: string
          notes?: string | null
          organiser?: string | null
          output_linkedin_published?: boolean
          output_media_stored?: boolean
          output_newsletter_mentioned?: boolean
          output_report_drafted?: boolean
          podcast_backup_completed?: boolean
          podcast_brief_ready?: boolean
          podcast_distribution_channels?: string[]
          podcast_edit_completed?: boolean
          podcast_episode_title?: string | null
          podcast_equipment_ready?: boolean
          podcast_followup_completed?: boolean
          podcast_followup_notes?: string | null
          podcast_guest_confirmed?: boolean
          podcast_guests?: string[]
          podcast_hosts?: string[]
          podcast_preparation_notes?: string | null
          podcast_published?: boolean
          podcast_recording_completed?: boolean
          podcast_recording_link?: string | null
          podcast_recording_mode?: string
          podcast_release_form_ready?: boolean
          podcast_run_of_show?: string | null
          podcast_series_name?: string | null
          podcast_show_notes_completed?: boolean
          podcast_transcript_completed?: boolean
          presentation_asset_url?: string | null
          presentation_summary?: string | null
          push_to_group_calendar?: boolean
          stage?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          attendance_kind?: string
          event_type?: string
          event_image_url?: string | null
          event_website_url?: string | null
          i2l_representatives?: string[] | null
          id?: string
          initiative_ids?: string[] | null
          is_annual_congress?: boolean
          is_i2l_organised?: boolean
          location_city?: string | null
          location_country?: string | null
          name?: string
          notes?: string | null
          organiser?: string | null
          output_linkedin_published?: boolean
          output_media_stored?: boolean
          output_newsletter_mentioned?: boolean
          output_report_drafted?: boolean
          podcast_backup_completed?: boolean
          podcast_brief_ready?: boolean
          podcast_distribution_channels?: string[]
          podcast_edit_completed?: boolean
          podcast_episode_title?: string | null
          podcast_equipment_ready?: boolean
          podcast_followup_completed?: boolean
          podcast_followup_notes?: string | null
          podcast_guest_confirmed?: boolean
          podcast_guests?: string[]
          podcast_hosts?: string[]
          podcast_preparation_notes?: string | null
          podcast_published?: boolean
          podcast_recording_completed?: boolean
          podcast_recording_link?: string | null
          podcast_recording_mode?: string
          podcast_release_form_ready?: boolean
          podcast_run_of_show?: string | null
          podcast_series_name?: string | null
          podcast_show_notes_completed?: boolean
          podcast_transcript_completed?: boolean
          presentation_asset_url?: string | null
          presentation_summary?: string | null
          push_to_group_calendar?: boolean
          stage?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      congress_event_themes: {
        Row: {
          event_id: string
          theme_id: string
        }
        Insert: {
          event_id: string
          theme_id: string
        }
        Update: {
          event_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_event_themes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "congress_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_event_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "congress_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_sessions: {
        Row: {
          id: string
          event_id: string
          topic_id: string | null
          title: string
          description: string | null
          session_type: string
          agenda_order: number
          start_time: string | null
          end_time: string | null
          room: string | null
          status: string
          session_lead_id: string | null
          note_taker_id: string | null
          max_attendees: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          topic_id?: string | null
          title: string
          description?: string | null
          session_type?: string
          agenda_order?: number
          start_time?: string | null
          end_time?: string | null
          room?: string | null
          status?: string
          session_lead_id?: string | null
          note_taker_id?: string | null
          max_attendees?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          topic_id?: string | null
          title?: string
          description?: string | null
          session_type?: string
          agenda_order?: number
          start_time?: string | null
          end_time?: string | null
          room?: string | null
          status?: string
          session_lead_id?: string | null
          note_taker_id?: string | null
          max_attendees?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "congress_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "congress_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_sessions_session_lead_id_fkey"
            columns: ["session_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_sessions_note_taker_id_fkey"
            columns: ["note_taker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_session_notes: {
        Row: {
          id: string
          session_id: string
          body: string
          version: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          body?: string
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          body?: string
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "congress_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_session_attendees: {
        Row: {
          session_id: string
          user_id: string
          role: string
          registered_at: string
          attended: boolean | null
        }
        Insert: {
          session_id: string
          user_id: string
          role?: string
          registered_at?: string
          attended?: boolean | null
        }
        Update: {
          session_id?: string
          user_id?: string
          role?: string
          registered_at?: string
          attended?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "congress_session_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "congress_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_session_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_assets: {
        Row: {
          id: string
          event_id: string
          session_id: string | null
          name: string
          description: string | null
          storage_path: string
          mime_type: string | null
          asset_type: string
          uploaded_by: string | null
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          session_id?: string | null
          name: string
          description?: string | null
          storage_path: string
          mime_type?: string | null
          asset_type?: string
          uploaded_by?: string | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          session_id?: string | null
          name?: string
          description?: string | null
          storage_path?: string
          mime_type?: string | null
          asset_type?: string
          uploaded_by?: string | null
          is_public?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "congress_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "congress_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_assignments: {
        Row: {
          id: string
          user_id: string
          congress_id: string
          project_role: string
          scope_all: boolean
          workstream_ids: string[]
          effective_from: string
          effective_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          congress_id: string
          project_role: string
          scope_all?: boolean
          workstream_ids?: string[]
          effective_from?: string
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          congress_id?: string
          project_role?: string
          scope_all?: boolean
          workstream_ids?: string[]
          effective_from?: string
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_assignments_congress_id_fkey"
            columns: ["congress_id"]
            isOneToOne: false
            referencedRelation: "congress_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      congress_topics: {
        Row: {
          id: string
          title: string
          description: string | null
          status: string
          vote_count: number
          event_id: string | null
          theme_id: string | null
          carryover_from_topic_id: string | null
          scheduled_session_id: string | null
          submitted_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: string
          vote_count?: number
          event_id?: string | null
          theme_id?: string | null
          carryover_from_topic_id?: string | null
          scheduled_session_id?: string | null
          submitted_by: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: string
          vote_count?: number
          event_id?: string | null
          theme_id?: string | null
          carryover_from_topic_id?: string | null
          scheduled_session_id?: string | null
          submitted_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congress_topics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "congress_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_topics_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "congress_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congress_topics_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string
          discussion_id: string
          id: string
          mentions: string[] | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          discussion_id: string
          id?: string
          mentions?: string[] | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          discussion_id?: string
          id?: string
          mentions?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "discussion_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "discussion_replies_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          author_id: string
          content: string
          created_at: string
          decision_date: string | null
          decision_made_by: string | null
          decision_summary: string | null
          id: string
          initiative_id: string
          is_pinned: boolean
          reply_count: number
          thread_type: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          decision_date?: string | null
          decision_made_by?: string | null
          decision_summary?: string | null
          id?: string
          initiative_id: string
          is_pinned?: boolean
          reply_count?: number
          thread_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          decision_date?: string | null
          decision_made_by?: string | null
          decision_summary?: string | null
          id?: string
          initiative_id?: string
          is_pinned?: boolean
          reply_count?: number
          thread_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "discussions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "discussions_decision_made_by_fkey"
            columns: ["decision_made_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "discussions_decision_made_by_fkey"
            columns: ["decision_made_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_decision_made_by_fkey"
            columns: ["decision_made_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "discussions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "discussions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
        ]
      }
      hub_initiatives: {
        Row: {
          hub_id: string
          id: string
          initiative_id: string
          local_notes: string | null
          local_status: string | null
        }
        Insert: {
          hub_id: string
          id?: string
          initiative_id: string
          local_notes?: string | null
          local_status?: string | null
        }
        Update: {
          hub_id?: string
          id?: string
          initiative_id?: string
          local_notes?: string | null
          local_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_initiatives_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_initiatives_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "hub_initiatives_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_initiatives_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_initiatives_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
        ]
      }
      hub_members: {
        Row: {
          hub_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          hub_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          hub_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_members_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "hub_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      hubs: {
        Row: {
          coordinator_id: string
          country: string
          created_at: string
          description: string | null
          established_date: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          status: string
          timezone: string
        }
        Insert: {
          coordinator_id: string
          country: string
          created_at?: string
          description?: string | null
          established_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          status?: string
          timezone?: string
        }
        Update: {
          coordinator_id?: string
          country?: string
          created_at?: string
          description?: string | null
          established_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubs_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "hubs_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hubs_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      initiative_members: {
        Row: {
          id: string
          initiative_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          initiative_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          initiative_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_members_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "initiative_members_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_members_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_members_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "initiative_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "initiative_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      initiatives: {
        Row: {
          cancer_types: string[] | null
          countries: string[] | null
          created_at: string
          description: string
          id: string
          lead_id: string
          objectives: Json | null
          phase: string
          pillar: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cancer_types?: string[] | null
          countries?: string[] | null
          created_at?: string
          description?: string
          id?: string
          lead_id: string
          objectives?: Json | null
          phase?: string
          pillar: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cancer_types?: string[] | null
          countries?: string[] | null
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          objectives?: Json | null
          phase?: string
          pillar?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiatives_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "initiatives_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      intake_items: {
        Row: {
          attached_media_ref: string | null
          capture_method: string
          captured_at: string
          classifier_reasoning: Json
          classifier_rule_ids: string[]
          classifier_status: string
          classifier_version: string | null
          classification_confidence: string | null
          content_type: string
          created_at: string
          dismissed_reason: string | null
          id: string
          is_peter_kapitein: boolean
          provider_message_id: string | null
          raw_content: string
          reviewed_at: string | null
          reviewed_by: string | null
          routed_to_id: string | null
          routed_to_type: string | null
          sender_name: string
          sender_whatsapp_id: string | null
          source_url: string | null
          status: string
        }
        Insert: {
          attached_media_ref?: string | null
          capture_method: string
          captured_at?: string
          classifier_reasoning?: Json
          classifier_rule_ids?: string[]
          classifier_status?: string
          classifier_version?: string | null
          classification_confidence?: string | null
          content_type: string
          created_at?: string
          dismissed_reason?: string | null
          id?: string
          is_peter_kapitein?: boolean
          provider_message_id?: string | null
          raw_content: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          routed_to_id?: string | null
          routed_to_type?: string | null
          sender_name: string
          sender_whatsapp_id?: string | null
          source_url?: string | null
          status?: string
        }
        Update: {
          attached_media_ref?: string | null
          capture_method?: string
          captured_at?: string
          classifier_reasoning?: Json
          classifier_rule_ids?: string[]
          classifier_status?: string
          classifier_version?: string | null
          classification_confidence?: string | null
          content_type?: string
          created_at?: string
          dismissed_reason?: string | null
          id?: string
          is_peter_kapitein?: boolean
          provider_message_id?: string | null
          raw_content?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          routed_to_id?: string | null
          routed_to_type?: string | null
          sender_name?: string
          sender_whatsapp_id?: string | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intake_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      intake_classification_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string | null
          corrected_content_type: string
          id: string
          intake_item_id: string
          previous_content_type: string
        }
        Insert: {
          corrected_at?: string
          corrected_by?: string | null
          corrected_content_type: string
          id?: string
          intake_item_id: string
          previous_content_type: string
        }
        Update: {
          corrected_at?: string
          corrected_by?: string | null
          corrected_content_type?: string
          id?: string
          intake_item_id?: string
          previous_content_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_classification_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intake_classification_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_classification_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "intake_classification_corrections_intake_item_id_fkey"
            columns: ["intake_item_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_classifier_rules: {
        Row: {
          created_at: string
          created_by: string | null
          created_from_correction_id: string | null
          description: string | null
          id: string
          is_enabled: boolean
          marks_peter: boolean
          match_field: string
          match_type: string
          pattern: string
          priority: number
          rule_name: string
          suggested_confidence: string
          suggested_content_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_from_correction_id?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          marks_peter?: boolean
          match_field: string
          match_type: string
          pattern: string
          priority?: number
          rule_name: string
          suggested_confidence?: string
          suggested_content_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_from_correction_id?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          marks_peter?: boolean
          match_field?: string
          match_type?: string
          pattern?: string
          priority?: number
          rule_name?: string
          suggested_confidence?: string
          suggested_content_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_classifier_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intake_classifier_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_classifier_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "intake_classifier_rules_created_from_correction_id_fkey"
            columns: ["created_from_correction_id"]
            isOneToOne: false
            referencedRelation: "intake_classification_corrections"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_classifier_training_examples: {
        Row: {
          classifier_snapshot: Json
          corrected_content_type: string
          correction_id: string | null
          created_at: string
          created_by: string | null
          id: string
          intake_item_id: string
          previous_content_type: string
          raw_content: string
          sender_name: string
        }
        Insert: {
          classifier_snapshot?: Json
          corrected_content_type: string
          correction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intake_item_id: string
          previous_content_type: string
          raw_content: string
          sender_name: string
        }
        Update: {
          classifier_snapshot?: Json
          corrected_content_type?: string
          correction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intake_item_id?: string
          previous_content_type?: string
          raw_content?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_classifier_training_examples_correction_id_fkey"
            columns: ["correction_id"]
            isOneToOne: true
            referencedRelation: "intake_classification_corrections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_classifier_training_examples_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intake_classifier_training_examples_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_classifier_training_examples_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "intake_classifier_training_examples_intake_item_id_fkey"
            columns: ["intake_item_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          asset_type: string
          contributed_by: string | null
          created_at: string
          event_id: string | null
          id: string
          initiative_id: string | null
          rights_status: string
          session_id: string | null
          sharepoint_url: string | null
          storage_path: string | null
          tags: string[] | null
          title: string
          usage_count: number
        }
        Insert: {
          asset_type: string
          contributed_by?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          initiative_id?: string | null
          rights_status?: string
          session_id?: string | null
          sharepoint_url?: string | null
          storage_path?: string | null
          tags?: string[] | null
          title: string
          usage_count?: number
        }
        Update: {
          asset_type?: string
          contributed_by?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          initiative_id?: string | null
          rights_status?: string
          session_id?: string | null
          sharepoint_url?: string | null
          storage_path?: string | null
          tags?: string[] | null
          title?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_contributed_by_fkey"
            columns: ["contributed_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "media_assets_contributed_by_fkey"
            columns: ["contributed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_contributed_by_fkey"
            columns: ["contributed_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "media_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "media_assets_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "media_assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "campus_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_recovery_offers: {
        Row: {
          created_at: string
          id: string
          intake_item_id: string
          notes: string
          offered_by: string
          recovery_request_id: string
          sharepoint_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intake_item_id: string
          notes: string
          offered_by: string
          recovery_request_id: string
          sharepoint_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intake_item_id?: string
          notes?: string
          offered_by?: string
          recovery_request_id?: string
          sharepoint_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_recovery_offers_intake_item_id_fkey"
            columns: ["intake_item_id"]
            isOneToOne: true
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_offers_recovery_request_id_fkey"
            columns: ["recovery_request_id"]
            isOneToOne: false
            referencedRelation: "media_recovery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      media_recovery_requests: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          initiative_id: string | null
          request_intake_id: string
          requested_by: string | null
          resolution_notes: string | null
          resolved_asset_id: string | null
          resolved_at: string | null
          session_id: string | null
          status: string
          summary: string
          title: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          initiative_id?: string | null
          request_intake_id: string
          requested_by?: string | null
          resolution_notes?: string | null
          resolved_asset_id?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          summary: string
          title: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          initiative_id?: string | null
          request_intake_id?: string
          requested_by?: string | null
          resolution_notes?: string | null
          resolved_asset_id?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_recovery_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_requests_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "media_recovery_requests_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_requests_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_requests_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "media_recovery_requests_request_intake_id_fkey"
            columns: ["request_intake_id"]
            isOneToOne: true
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "media_recovery_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "media_recovery_requests_resolved_asset_id_fkey"
            columns: ["resolved_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_recovery_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "campus_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          failure_reason: string | null
          id: string
          intake_item_id: string | null
          payload: Json
          processed_at: string | null
          processing_status: string
          provider: string
          provider_message_id: string
          received_at: string
          sender_name: string | null
          sender_whatsapp_id: string | null
        }
        Insert: {
          failure_reason?: string | null
          id?: string
          intake_item_id?: string | null
          payload: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_message_id: string
          received_at?: string
          sender_name?: string | null
          sender_whatsapp_id?: string | null
        }
        Update: {
          failure_reason?: string | null
          id?: string
          intake_item_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_message_id?: string
          received_at?: string
          sender_name?: string | null
          sender_whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_intake_item_id_fkey"
            columns: ["intake_item_id"]
            isOneToOne: false
            referencedRelation: "intake_items"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_date: string | null
          created_at: string
          description: string | null
          evidence_required: boolean
          id: string
          initiative_id: string
          sort_order: number
          status: string
          target_date: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          evidence_required?: boolean
          id?: string
          initiative_id: string
          sort_order?: number
          status?: string
          target_date: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          evidence_required?: boolean
          id?: string
          initiative_id?: string
          sort_order?: number
          status?: string
          target_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "milestones_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          initiative_id: string | null
          is_read: boolean
          link_url: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          initiative_id?: string | null
          is_read?: boolean
          link_url?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          initiative_id?: string | null
          is_read?: boolean
          link_url?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "notifications_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      partner_audit_entries: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          engagement_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          engagement_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          engagement_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_audit_entries_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partner_audit_entries_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_audit_entries_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "partner_audit_entries_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "partner_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_engagements: {
        Row: {
          contribution_type: string
          created_at: string
          id: string
          initiative_id: string
          neutrality_date: string | null
          neutrality_declared: boolean
          partner_id: string
          reviewed_date: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          scope_description: string
          status: string
          updated_at: string
        }
        Insert: {
          contribution_type: string
          created_at?: string
          id?: string
          initiative_id: string
          neutrality_date?: string | null
          neutrality_declared?: boolean
          partner_id: string
          reviewed_date?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          scope_description: string
          status?: string
          updated_at?: string
        }
        Update: {
          contribution_type?: string
          created_at?: string
          id?: string
          initiative_id?: string
          neutrality_date?: string | null
          neutrality_declared?: boolean
          partner_id?: string
          reviewed_date?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          scope_description?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_engagements_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "partner_engagements_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_engagements_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_engagements_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "partner_engagements_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partner_engagements_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_engagements_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "partner_engagements_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partner_engagements_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_engagements_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          comms_team: boolean
          country: string
          created_at: string
          email: string
          expertise_tags: string[] | null
          hero_of_cancer_year: number | null
          id: string
          language: string
          last_active_at: string
          name: string
          notification_prefs: Json
          onboarding_completed: boolean
          organization: string | null
          role: string
          timezone: string
          updated_at: string
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          comms_team?: boolean
          country: string
          created_at?: string
          email: string
          expertise_tags?: string[] | null
          hero_of_cancer_year?: number | null
          id: string
          language?: string
          last_active_at?: string
          name: string
          notification_prefs?: Json
          onboarding_completed?: boolean
          organization?: string | null
          role: string
          timezone?: string
          updated_at?: string
          user_type?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          comms_team?: boolean
          country?: string
          created_at?: string
          email?: string
          expertise_tags?: string[] | null
          hero_of_cancer_year?: number | null
          id?: string
          language?: string
          last_active_at?: string
          name?: string
          notification_prefs?: Json
          onboarding_completed?: boolean
          organization?: string | null
          role?: string
          timezone?: string
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          cancer_types: string[] | null
          countries: string[] | null
          created_at: string
          external_url: string | null
          file_size_bytes: number | null
          file_url: string | null
          fts: unknown
          id: string
          initiative_id: string | null
          is_partner_contribution: boolean
          language: string
          mime_type: string | null
          partner_organization: string | null
          storage_path: string | null
          supersedes_id: string | null
          tags: string[] | null
          title: string
          translation_status: string
          type: string
          uploaded_by_id: string
          version: number
        }
        Insert: {
          cancer_types?: string[] | null
          countries?: string[] | null
          created_at?: string
          external_url?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          fts?: unknown
          id?: string
          initiative_id?: string | null
          is_partner_contribution?: boolean
          language?: string
          mime_type?: string | null
          partner_organization?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          tags?: string[] | null
          title: string
          translation_status?: string
          type: string
          uploaded_by_id: string
          version?: number
        }
        Update: {
          cancer_types?: string[] | null
          countries?: string[] | null
          created_at?: string
          external_url?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          fts?: unknown
          id?: string
          initiative_id?: string | null
          is_partner_contribution?: boolean
          language?: string
          mime_type?: string | null
          partner_organization?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          tags?: string[] | null
          title?: string
          translation_status?: string
          type?: string
          uploaded_by_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "resources_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "resources_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      session_attendees: {
        Row: {
          attended: boolean
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "world_campus_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string
          congress_decision_id: string | null
          created_at: string
          created_from: string
          description: string | null
          due_date: string | null
          id: string
          initiative_id: string
          milestone_id: string | null
          priority: string
          reporter_id: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id: string
          congress_decision_id?: string | null
          created_at?: string
          created_from?: string
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id: string
          milestone_id?: string | null
          priority?: string
          reporter_id: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string
          congress_decision_id?: string | null
          created_at?: string
          created_from?: string
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string
          milestone_id?: string | null
          priority?: string
          reporter_id?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
          {
            foreignKeyName: "tasks_congress_decision_id_fkey"
            columns: ["congress_decision_id"]
            isOneToOne: false
            referencedRelation: "congress_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_congress_decision_id_fkey"
            columns: ["congress_decision_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "decision_pipeline"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiative_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["initiative_id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      topic_votes: {
        Row: {
          created_at: string
          id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_votes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "congress_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "topic_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      world_campus_sessions: {
        Row: {
          agenda: string | null
          created_at: string
          description: string | null
          hub_id: string | null
          id: string
          materials_urls: string[] | null
          recording_url: string | null
          scheduled_date: string
          status: string
          timezone: string
          title: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          description?: string | null
          hub_id?: string | null
          id?: string
          materials_urls?: string[] | null
          recording_url?: string | null
          scheduled_date: string
          status?: string
          timezone?: string
          title: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          description?: string | null
          hub_id?: string | null
          id?: string
          materials_urls?: string[] | null
          recording_url?: string | null
          scheduled_date?: string
          status?: string
          timezone?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_campus_sessions_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      // ─── Added by migration 00022 (permission system) ──────────────────────
      user_space_permissions: {
        Row: {
          id: string
          user_id: string
          space: string
          access_level: string
          scope_type: string
          scope_id: string | null
          granted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          space: string
          access_level: string
          scope_type?: string
          scope_id?: string | null
          granted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          space?: string
          access_level?: string
          scope_type?: string
          scope_id?: string | null
          granted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          id: string
          target_user_id: string
          changed_by: string
          change_type: string
          previous_value: Record<string, unknown> | null
          new_value: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          target_user_id: string
          changed_by: string
          change_type: string
          previous_value?: Record<string, unknown> | null
          new_value?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          target_user_id?: string
          changed_by?: string
          change_type?: string
          previous_value?: Record<string, unknown> | null
          new_value?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
      role_space_default_overrides: {
        Row: {
          role: string
          space: string
          access_level: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          role: string
          space: string
          access_level: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          role?: string
          space?: string
          access_level?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      decision_pipeline: {
        Row: {
          captured_at: string | null
          congress_theme: string | null
          congress_year: number | null
          conversion_status: string | null
          deadline: string | null
          decision_id: string | null
          description: string | null
          initiative_id: string | null
          initiative_title: string | null
          owner_email: string | null
          owner_name: string | null
          proposed_by: string | null
          session_time: string | null
          session_title: string | null
          task_id: string | null
          task_status: string | null
          task_title: string | null
        }
        Relationships: []
      }
      initiative_health: {
        Row: {
          approaching_milestones: number | null
          blocked_tasks: number | null
          cancer_types: string[] | null
          completed_milestones: number | null
          completed_tasks: number | null
          countries: string[] | null
          created_at: string | null
          id: string | null
          last_activity_at: string | null
          lead_avatar_url: string | null
          lead_country: string | null
          lead_id: string | null
          lead_name: string | null
          member_count: number | null
          next_milestone: Json | null
          open_tasks: number | null
          overdue_milestones: number | null
          phase: string | null
          pillar: string | null
          status: string | null
          title: string | null
          total_milestones: number | null
          total_tasks: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "initiatives_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "member_activity_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "initiatives_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["uploader_id"]
          },
        ]
      }
      member_activity_summary: {
        Row: {
          blocked_task_count: number | null
          country: string | null
          days_since_activity: number | null
          email: string | null
          initiative_count: number | null
          last_action_at: string | null
          last_active_at: string | null
          name: string | null
          onboarding_completed: boolean | null
          open_task_count: number | null
          overdue_task_count: number | null
          role: string | null
          user_id: string | null
        }
        Relationships: []
      }
      resource_library: {
        Row: {
          cancer_types: string[] | null
          countries: string[] | null
          created_at: string | null
          external_url: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string | null
          initiative_id: string | null
          initiative_pillar: string | null
          initiative_title: string | null
          is_partner_contribution: boolean | null
          language: string | null
          mime_type: string | null
          partner_organization: string | null
          supersedes_id: string | null
          tags: string[] | null
          title: string | null
          translation_status: string | null
          type: string | null
          uploader_avatar_url: string | null
          uploader_id: string | null
          uploader_name: string | null
          uploader_organization: string | null
          uploader_role: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_context: { Args: never; Returns: Json }
      current_user_role: { Args: never; Returns: string }
      is_comms_team_or_admin: { Args: never; Returns: boolean }
      is_coordinator_or_admin: { Args: never; Returns: boolean }
      is_initiative_lead: { Args: { init_id: string }; Returns: boolean }
      is_initiative_member: { Args: { init_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
