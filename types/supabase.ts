export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_grants: {
        Row: {
          access_level: string | null
          app_id: string
          created_at: string
          employee_id: string
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          is_required: boolean
          needs_review: boolean
          notes: string | null
          request_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          source: string
          status: Database["public"]["Enums"]["access_status"]
          updated_at: string
          vault: string | null
        }
        Insert: {
          access_level?: string | null
          app_id: string
          created_at?: string
          employee_id: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_required?: boolean
          needs_review?: boolean
          notes?: string | null
          request_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
          vault?: string | null
        }
        Update: {
          access_level?: string | null
          app_id?: string
          created_at?: string
          employee_id?: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_required?: boolean
          needs_review?: boolean
          notes?: string | null
          request_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
          vault?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "external_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      access_requests: {
        Row: {
          access_level: string | null
          app_id: string
          approval_group_id: string | null
          created_at: string
          decided_at: string | null
          employee_id: string
          id: string
          reason: string
          requested_by: string | null
          status: string
        }
        Insert: {
          access_level?: string | null
          app_id: string
          approval_group_id?: string | null
          created_at?: string
          decided_at?: string | null
          employee_id: string
          id?: string
          reason: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          access_level?: string | null
          app_id?: string
          approval_group_id?: string | null
          created_at?: string
          decided_at?: string | null
          employee_id?: string
          id?: string
          reason?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "external_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          direction: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          outcome: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          reminder_at: string | null
          reminder_sent_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          direction?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          direction?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_event_links: {
        Row: {
          entity_id: string
          entity_type: string
          event_id: number
        }
        Insert: {
          entity_id: string
          entity_type: string
          event_id: number
        }
        Update: {
          entity_id?: string
          entity_type?: string
          event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          dedupe_key: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: number
          occurred_at: string
          payload: Json
          processed_at: string | null
          summary: string
          visibility: string
        }
        Insert: {
          actor_type?: string
          actor_user_id?: string | null
          dedupe_key?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: never
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          summary: string
          visibility?: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          dedupe_key?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: never
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          summary?: string
          visibility?: string
        }
        Relationships: []
      }
      ad_accounts: {
        Row: {
          connection_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          external_id: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          mode: string
          name: string
          platform: string
          status: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          mode?: string
          name: string
          platform: string
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          mode?: string
          name?: string
          platform?: string
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_alert_rules: {
        Row: {
          account_id: string | null
          comparator: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_triggered_on: string | null
          metric: string
          name: string
          notify_user_ids: string[]
          threshold: number
        }
        Insert: {
          account_id?: string | null
          comparator: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_triggered_on?: string | null
          metric: string
          name: string
          notify_user_ids?: string[]
          threshold: number
        }
        Update: {
          account_id?: string | null
          comparator?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_triggered_on?: string | null
          metric?: string
          name?: string
          notify_user_ids?: string[]
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_alert_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          account_id: string
          daily_budget: number | null
          end_at: string | null
          external_id: string
          id: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          start_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          daily_budget?: number | null
          end_at?: string | null
          external_id: string
          id?: string
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          start_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          daily_budget?: number | null
          end_at?: string | null
          external_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          start_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights_daily: {
        Row: {
          account_id: string
          clicks: number
          conversion_value: number | null
          conversions: number | null
          currency: string
          day: string
          fetched_at: string
          impressions: number
          level: string
          object_id: string
          reach: number | null
          source: string
          spend: number
        }
        Insert: {
          account_id: string
          clicks?: number
          conversion_value?: number | null
          conversions?: number | null
          currency: string
          day: string
          fetched_at?: string
          impressions?: number
          level: string
          object_id: string
          reach?: number | null
          source: string
          spend?: number
        }
        Update: {
          account_id?: string
          clicks?: number
          conversion_value?: number | null
          conversions?: number | null
          currency?: string
          day?: string
          fetched_at?: string
          impressions?: number
          level?: string
          object_id?: string
          reach?: number | null
          source?: string
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sets: {
        Row: {
          campaign_id: string
          daily_budget: number | null
          external_id: string
          id: string
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          daily_budget?: number | null
          external_id: string
          id?: string
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          daily_budget?: number | null
          external_id?: string
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_set_id: string | null
          campaign_id: string
          creative_id: string | null
          creative_post_id: string | null
          external_id: string
          id: string
          name: string
          social_target_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ad_set_id?: string | null
          campaign_id: string
          creative_id?: string | null
          creative_post_id?: string | null
          external_id: string
          id?: string
          name: string
          social_target_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ad_set_id?: string | null
          campaign_id?: string
          creative_id?: string | null
          creative_post_id?: string | null
          external_id?: string
          id?: string
          name?: string
          social_target_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_social_target_id_fkey"
            columns: ["social_target_id"]
            isOneToOne: false
            referencedRelation: "social_post_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          created_at: string
          created_by: string | null
          fallback_message: string
          handoff_keywords: string[]
          handoff_message: string
          id: string
          instructions: string | null
          is_active: boolean
          kb_category_ids: string[]
          language: string
          max_ai_turns: number
          min_confidence: number
          monthly_cost_limit_usd: number
          name: string
          persona: string | null
          provider: string | null
          sensitive_keywords: string[]
          tone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fallback_message?: string
          handoff_keywords?: string[]
          handoff_message?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          kb_category_ids?: string[]
          language?: string
          max_ai_turns?: number
          min_confidence?: number
          monthly_cost_limit_usd?: number
          name: string
          persona?: string | null
          provider?: string | null
          sensitive_keywords?: string[]
          tone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fallback_message?: string
          handoff_keywords?: string[]
          handoff_message?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          kb_category_ids?: string[]
          language?: string
          max_ai_turns?: number
          min_confidence?: number
          monthly_cost_limit_usd?: number
          name?: string
          persona?: string | null
          provider?: string | null
          sensitive_keywords?: string[]
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          connection_id: string | null
          cost_micros: number
          created_at: string
          error: string | null
          fallback_from: string | null
          feature: string
          id: number
          input_tokens: number
          model: string
          ok: boolean
          output_tokens: number
          provider: string
          user_id: string | null
        }
        Insert: {
          connection_id?: string | null
          cost_micros?: number
          created_at?: string
          error?: string | null
          fallback_from?: string | null
          feature: string
          id?: never
          input_tokens?: number
          model: string
          ok: boolean
          output_tokens?: number
          provider: string
          user_id?: string | null
        }
        Update: {
          connection_id?: string | null
          cost_micros?: number
          created_at?: string
          error?: string | null
          fallback_from?: string | null
          feature?: string
          id?: never
          input_tokens?: number
          model?: string
          ok?: boolean
          output_tokens?: number
          provider?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_delegations: {
        Row: {
          approval_types: string[]
          created_at: string
          created_by: string | null
          delegate_user_id: string
          ends_on: string
          id: string
          is_active: boolean
          reason: string | null
          starts_on: string
          user_id: string
        }
        Insert: {
          approval_types?: string[]
          created_at?: string
          created_by?: string | null
          delegate_user_id: string
          ends_on: string
          id?: string
          is_active?: boolean
          reason?: string | null
          starts_on: string
          user_id: string
        }
        Update: {
          approval_types?: string[]
          created_at?: string
          created_by?: string | null
          delegate_user_id?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          starts_on?: string
          user_id?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          approver_contact_id: string | null
          approver_role_id: string | null
          approver_user_id: string | null
          client_visible: boolean
          decided_at: string | null
          decided_by_contact_id: string | null
          decided_by_user_id: string | null
          decision_comment: string | null
          delegated_from: string | null
          due_at: string | null
          entity_id: string
          entity_type: string
          group_id: string
          id: string
          payload: Json
          reminded_at: string | null
          requested_at: string
          requested_by: string | null
          requested_by_contact_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
          step: number
          title: string
          total_steps: number
          version: number
        }
        Insert: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          approver_contact_id?: string | null
          approver_role_id?: string | null
          approver_user_id?: string | null
          client_visible?: boolean
          decided_at?: string | null
          decided_by_contact_id?: string | null
          decided_by_user_id?: string | null
          decision_comment?: string | null
          delegated_from?: string | null
          due_at?: string | null
          entity_id: string
          entity_type: string
          group_id?: string
          id?: string
          payload?: Json
          reminded_at?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_by_contact_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          step?: number
          title: string
          total_steps?: number
          version?: number
        }
        Update: {
          approval_type?: Database["public"]["Enums"]["approval_type"]
          approver_contact_id?: string | null
          approver_role_id?: string | null
          approver_user_id?: string | null
          client_visible?: boolean
          decided_at?: string | null
          decided_by_contact_id?: string | null
          decided_by_user_id?: string | null
          decision_comment?: string | null
          delegated_from?: string | null
          due_at?: string | null
          entity_id?: string
          entity_type?: string
          group_id?: string
          id?: string
          payload?: Json
          reminded_at?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_by_contact_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          step?: number
          title?: string
          total_steps?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_role_id_fkey"
            columns: ["approver_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_events: {
        Row: {
          actor_user_id: string | null
          cost: number | null
          detail: string | null
          device_id: string
          employee_id: string | null
          from_branch_id: string | null
          id: number
          kind: string
          occurred_at: string
          quantity: number | null
          to_branch_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          cost?: number | null
          detail?: string | null
          device_id: string
          employee_id?: string | null
          from_branch_id?: string | null
          id?: number
          kind: string
          occurred_at?: string
          quantity?: number | null
          to_branch_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          cost?: number | null
          detail?: string | null
          device_id?: string
          employee_id?: string | null
          from_branch_id?: string | null
          id?: number
          kind?: string
          occurred_at?: string
          quantity?: number | null
          to_branch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_events_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_events_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          cost: number | null
          currency: string | null
          description: string
          device_id: string
          id: string
          opened_at: string
          opened_by: string | null
          previous_status: string | null
          result: string | null
          status: string
          vendor_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          cost?: number | null
          currency?: string | null
          description: string
          device_id: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          previous_status?: string | null
          result?: string | null
          status?: string
          vendor_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          cost?: number | null
          currency?: string | null
          description?: string
          device_id?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          previous_status?: string | null
          result?: string | null
          status?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          provider: string | null
          role: string
          thread_id: string
          tools: Json
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          provider?: string | null
          role: string
          thread_id: string
          tools?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          provider?: string | null
          role?: string
          thread_id?: string
          tools?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance_breaks: {
        Row: {
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          session_id: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          session_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_breaks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_corrections: {
        Row: {
          approval_group_id: string | null
          id: string
          original: Json
          reason: string
          record_id: string | null
          requested_clock_in: string | null
          requested_clock_out: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["correction_status"]
          submitted_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          approval_group_id?: string | null
          id?: string
          original?: Json
          reason: string
          record_id?: string | null
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          submitted_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          approval_group_id?: string | null
          id?: string
          original?: Json
          reason?: string
          record_id?: string | null
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          submitted_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          break_minutes: number
          created_at: string
          expected_minutes: number
          first_clock_in: string | null
          id: string
          is_remote: boolean
          last_clock_out: string | null
          last_system_activity_at: string | null
          late_minutes: number
          overtime_minutes: number
          requires_review: boolean
          review_reason: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          timezone: string
          updated_at: string
          user_id: string
          work_date: string
          worked_minutes: number
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          expected_minutes?: number
          first_clock_in?: string | null
          id?: string
          is_remote?: boolean
          last_clock_out?: string | null
          last_system_activity_at?: string | null
          late_minutes?: number
          overtime_minutes?: number
          requires_review?: boolean
          review_reason?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          timezone: string
          updated_at?: string
          user_id: string
          work_date: string
          worked_minutes?: number
        }
        Update: {
          break_minutes?: number
          created_at?: string
          expected_minutes?: number
          first_clock_in?: string | null
          id?: string
          is_remote?: boolean
          last_clock_out?: string | null
          last_system_activity_at?: string | null
          late_minutes?: number
          overtime_minutes?: number
          requires_review?: boolean
          review_reason?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          timezone?: string
          updated_at?: string
          user_id?: string
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          auto_closed: boolean
          clock_in_at: string
          clock_in_timezone: string | null
          clock_out_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          record_id: string
          source: string
          user_id: string
        }
        Insert: {
          auto_closed?: boolean
          clock_in_at: string
          clock_in_timezone?: string | null
          clock_out_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          record_id: string
          source?: string
          user_id: string
        }
        Update: {
          auto_closed?: boolean
          clock_in_at?: string
          clock_in_timezone?: string | null
          clock_out_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          record_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          metadata: Json
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          metadata?: Json
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          metadata?: Json
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      authors: {
        Row: {
          avatar_url: string | null
          bio_ar: string | null
          bio_en: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          avatar_url?: string | null
          bio_ar?: string | null
          bio_en?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          avatar_url?: string | null
          bio_ar?: string | null
          bio_en?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json
          condition_logic: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          priority: number
          run_once_per_entity: boolean
          trigger_event: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          condition_logic?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          priority?: number
          run_once_per_entity?: boolean
          trigger_event: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          condition_logic?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          priority?: number
          run_once_per_entity?: boolean
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          entity_id: string | null
          entity_type: string | null
          error: string | null
          event_id: number | null
          finished_at: string | null
          id: string
          is_retry: boolean
          results: Json
          rule_id: string
          rule_snapshot: Json | null
          started_at: string
          status: string
        }
        Insert: {
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_id?: number | null
          finished_at?: string | null
          id?: string
          is_retry?: boolean
          results?: Json
          rule_id: string
          rule_snapshot?: Json | null
          started_at?: string
          status: string
        }
        Update: {
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_id?: number | null
          finished_at?: string | null
          id?: string
          is_retry?: boolean
          results?: Json
          rule_id?: string
          rule_snapshot?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          end_time: string
          id: string
          is_active: boolean
          slot_minutes: number
          start_time: string
          timezone: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          is_active?: boolean
          slot_minutes?: number
          start_time: string
          timezone?: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          is_active?: boolean
          slot_minutes?: number
          start_time?: string
          timezone?: string
          weekday?: number
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      blogs: {
        Row: {
          author_id: string | null
          category_id: string | null
          content_ar: string
          content_en: string
          created_at: string
          excerpt_ar: string | null
          excerpt_en: string | null
          featured_image: string | null
          id: string
          published_at: string | null
          reading_time_minutes: number | null
          slug: string
          status: string
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content_ar: string
          content_en: string
          created_at?: string
          excerpt_ar?: string | null
          excerpt_en?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          reading_time_minutes?: number | null
          slug: string
          status?: string
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content_ar?: string
          content_en?: string
          created_at?: string
          excerpt_ar?: string | null
          excerpt_en?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          reading_time_minutes?: number | null
          slug?: string
          status?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blogs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_answers: {
        Row: {
          answers: Json | null
          booking_id: string
          created_at: string
          decision_maker: string | null
          gcc_resident: string | null
          id: string
          idea_clarity: string | null
          investment_readiness: string | null
          need: string | null
          project_type: string | null
          revenue_goal: string | null
          source: string | null
          start_timing: string | null
          validation_stage: string | null
        }
        Insert: {
          answers?: Json | null
          booking_id: string
          created_at?: string
          decision_maker?: string | null
          gcc_resident?: string | null
          id?: string
          idea_clarity?: string | null
          investment_readiness?: string | null
          need?: string | null
          project_type?: string | null
          revenue_goal?: string | null
          source?: string | null
          start_timing?: string | null
          validation_stage?: string | null
        }
        Update: {
          answers?: Json | null
          booking_id?: string
          created_at?: string
          decision_maker?: string | null
          gcc_resident?: string | null
          id?: string
          idea_clarity?: string | null
          investment_readiness?: string | null
          need?: string | null
          project_type?: string | null
          revenue_goal?: string | null
          source?: string | null
          start_timing?: string | null
          validation_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_answers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          scheduled_end: string
          scheduled_start: string
          service: string
          status: string
          timezone: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          scheduled_end: string
          scheduled_start: string
          service?: string
          status?: string
          timezone?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          scheduled_end?: string
          scheduled_start?: string
          service?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bos_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          geofence_m: number | null
          id: string
          is_head_office: boolean
          latitude: number | null
          longitude: number | null
          manager_employee_id: string | null
          name: string
          name_en: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          status: string
          timezone: string
          updated_at: string
          work_schedule_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          geofence_m?: number | null
          id?: string
          is_head_office?: boolean
          latitude?: number | null
          longitude?: number | null
          manager_employee_id?: string | null
          name: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          work_schedule_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          geofence_m?: number | null
          id?: string
          is_head_office?: boolean
          latitude?: number | null
          longitude?: number | null
          manager_employee_id?: string | null
          name?: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "branches_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_events: {
        Row: {
          actor_user_id: string | null
          camera_id: string
          detail: string | null
          id: number
          kind: string
          occurred_at: string
        }
        Insert: {
          actor_user_id?: string | null
          camera_id: string
          detail?: string | null
          id?: number
          kind: string
          occurred_at?: string
        }
        Update: {
          actor_user_id?: string | null
          camera_id?: string
          detail?: string | null
          id?: number
          kind?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_events_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      cameras: {
        Row: {
          allowed_role_ids: string[]
          branch_id: string | null
          connection_status: string
          connection_type: string
          created_at: string
          created_by: string | null
          id: string
          last_checked_at: string | null
          last_error: string | null
          location_label: string | null
          model: string | null
          name: string
          notes: string | null
          notice_displayed: boolean
          serial_number: string | null
          status: string
          updated_at: string
          vendor: string | null
          viewer_url: string | null
        }
        Insert: {
          allowed_role_ids?: string[]
          branch_id?: string | null
          connection_status?: string
          connection_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          location_label?: string | null
          model?: string | null
          name: string
          notes?: string | null
          notice_displayed?: boolean
          serial_number?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
          viewer_url?: string | null
        }
        Update: {
          allowed_role_ids?: string[]
          branch_id?: string | null
          connection_status?: string
          connection_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          location_label?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          notice_displayed?: boolean
          serial_number?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
          viewer_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cameras_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          country: string | null
          created_at: string
          created_by: string | null
          current_title: string | null
          email: string
          employee_id: string | null
          expected_salary: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          source: string
          status: string
          tags: string[]
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_title?: string | null
          email: string
          employee_id?: string | null
          expected_salary?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_title?: string | null
          email?: string
          employee_id?: string | null
          expected_salary?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      career_applications: {
        Row: {
          age: number
          bio: string
          candidate_id: string | null
          country: string
          courses_completed: string | null
          created_at: string
          education_status: string
          email: string
          expected_salary: string
          first_name: string
          id: string
          instagram_handle: string
          internal_notes: string | null
          job_id: string
          last_name: string
          other_socials: string | null
          phone: string
          portfolio_path: string | null
          rating: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          stage_changed_at: string | null
          status: string
          updated_at: string
          why_fit: string
          years_experience: number
        }
        Insert: {
          age: number
          bio: string
          candidate_id?: string | null
          country: string
          courses_completed?: string | null
          created_at?: string
          education_status: string
          email: string
          expected_salary: string
          first_name: string
          id?: string
          instagram_handle: string
          internal_notes?: string | null
          job_id: string
          last_name: string
          other_socials?: string | null
          phone: string
          portfolio_path?: string | null
          rating?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          stage_changed_at?: string | null
          status?: string
          updated_at?: string
          why_fit: string
          years_experience?: number
        }
        Update: {
          age?: number
          bio?: string
          candidate_id?: string | null
          country?: string
          courses_completed?: string | null
          created_at?: string
          education_status?: string
          email?: string
          expected_salary?: string
          first_name?: string
          id?: string
          instagram_handle?: string
          internal_notes?: string | null
          job_id?: string
          last_name?: string
          other_socials?: string | null
          phone?: string
          portfolio_path?: string | null
          rating?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          stage_changed_at?: string | null
          status?: string
          updated_at?: string
          why_fit?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "career_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "career_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      career_interviews: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          feedback: string | null
          format: string
          id: string
          interviewer_name: string | null
          interviewer_user_id: string | null
          location: string | null
          meeting_id: string | null
          meeting_link: string | null
          outcome: string
          round: number
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          feedback?: string | null
          format?: string
          id?: string
          interviewer_name?: string | null
          interviewer_user_id?: string | null
          location?: string | null
          meeting_id?: string | null
          meeting_link?: string | null
          outcome?: string
          round?: number
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          feedback?: string | null
          format?: string
          id?: string
          interviewer_name?: string | null
          interviewer_user_id?: string | null
          location?: string | null
          meeting_id?: string | null
          meeting_link?: string | null
          outcome?: string
          round?: number
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "career_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_interviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      career_jobs: {
        Row: {
          branch_id: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          disqualifiers: string
          employment_type: string
          hiring_manager_id: string | null
          id: string
          ideal_candidate: string
          is_published: boolean
          location: string
          openings: number
          published_at: string | null
          requirements: string
          responsibilities: string
          role_description: string
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          slug: string
          status: string
          summary: string
          team: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          disqualifiers: string
          employment_type: string
          hiring_manager_id?: string | null
          id?: string
          ideal_candidate: string
          is_published?: boolean
          location: string
          openings?: number
          published_at?: string | null
          requirements: string
          responsibilities: string
          role_description: string
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          slug: string
          status?: string
          summary: string
          team: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          disqualifiers?: string
          employment_type?: string
          hiring_manager_id?: string | null
          id?: string
          ideal_candidate?: string
          is_published?: boolean
          location?: string
          openings?: number
          published_at?: string | null
          requirements?: string
          responsibilities?: string
          role_description?: string
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          slug?: string
          status?: string
          summary?: string
          team?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_jobs_salary_currency_fkey"
            columns: ["salary_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "career_jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          challenge_ar: string | null
          challenge_en: string | null
          client_name: string | null
          country_ar: string | null
          country_en: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          featured: boolean
          featured_image: string | null
          id: string
          industry_ar: string | null
          industry_en: string | null
          key_features: string[]
          published_at: string | null
          result_ar: string | null
          result_en: string | null
          services: string[]
          short_description_ar: string | null
          short_description_en: string | null
          slug: string
          solution_ar: string | null
          solution_en: string | null
          sort_order: number
          status: string
          testimonial_author: string | null
          testimonial_quote_ar: string | null
          testimonial_quote_en: string | null
          testimonial_role_ar: string | null
          testimonial_role_en: string | null
          title: string
          updated_at: string
          users_count: string | null
          website_url: string | null
        }
        Insert: {
          challenge_ar?: string | null
          challenge_en?: string | null
          client_name?: string | null
          country_ar?: string | null
          country_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          featured?: boolean
          featured_image?: string | null
          id?: string
          industry_ar?: string | null
          industry_en?: string | null
          key_features?: string[]
          published_at?: string | null
          result_ar?: string | null
          result_en?: string | null
          services?: string[]
          short_description_ar?: string | null
          short_description_en?: string | null
          slug: string
          solution_ar?: string | null
          solution_en?: string | null
          sort_order?: number
          status?: string
          testimonial_author?: string | null
          testimonial_quote_ar?: string | null
          testimonial_quote_en?: string | null
          testimonial_role_ar?: string | null
          testimonial_role_en?: string | null
          title: string
          updated_at?: string
          users_count?: string | null
          website_url?: string | null
        }
        Update: {
          challenge_ar?: string | null
          challenge_en?: string | null
          client_name?: string | null
          country_ar?: string | null
          country_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          featured?: boolean
          featured_image?: string | null
          id?: string
          industry_ar?: string | null
          industry_en?: string | null
          key_features?: string[]
          published_at?: string | null
          result_ar?: string | null
          result_en?: string | null
          services?: string[]
          short_description_ar?: string | null
          short_description_en?: string | null
          slug?: string
          solution_ar?: string | null
          solution_en?: string | null
          sort_order?: number
          status?: string
          testimonial_author?: string | null
          testimonial_quote_ar?: string | null
          testimonial_quote_en?: string | null
          testimonial_role_ar?: string | null
          testimonial_role_en?: string | null
          title?: string
          updated_at?: string
          users_count?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      case_study_media: {
        Row: {
          caption: string | null
          case_study_id: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          case_study_id: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          case_study_id?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_study_media_case_study_id_fkey"
            columns: ["case_study_id"]
            isOneToOne: false
            referencedRelation: "case_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      case_study_metrics: {
        Row: {
          case_study_id: string
          id: string
          label: string
          sort_order: number
          value_display: string
          value_numeric: number | null
        }
        Insert: {
          case_study_id: string
          id?: string
          label: string
          sort_order?: number
          value_display: string
          value_numeric?: number | null
        }
        Update: {
          case_study_id?: string
          id?: string
          label?: string
          sort_order?: number
          value_display?: string
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_study_metrics_case_study_id_fkey"
            columns: ["case_study_id"]
            isOneToOne: false
            referencedRelation: "case_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          additional_cost: number
          additional_days: number
          applied_at: string | null
          approval_group_id: string | null
          client_id: string
          cr_number: string
          created_at: string
          currency: string
          decided_at: string | null
          description: string | null
          id: string
          impact: string | null
          invoice_id: string | null
          project_id: string
          reason: string | null
          requested_by_contact_id: string | null
          requested_by_user_id: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          additional_cost?: number
          additional_days?: number
          applied_at?: string | null
          approval_group_id?: string | null
          client_id: string
          cr_number?: string
          created_at?: string
          currency: string
          decided_at?: string | null
          description?: string | null
          id?: string
          impact?: string | null
          invoice_id?: string | null
          project_id: string
          reason?: string | null
          requested_by_contact_id?: string | null
          requested_by_user_id?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          additional_cost?: number
          additional_days?: number
          applied_at?: string | null
          approval_group_id?: string | null
          client_id?: string
          cr_number?: string
          created_at?: string
          currency?: string
          decided_at?: string | null
          description?: string | null
          id?: string
          impact?: string | null
          invoice_id?: string | null
          project_id?: string
          reason?: string | null
          requested_by_contact_id?: string | null
          requested_by_user_id?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "change_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_requested_by_contact_id_fkey"
            columns: ["requested_by_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          archived_at: string | null
          client_id: string | null
          client_visible: boolean
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          direct_key: string | null
          id: string
          is_private: boolean
          kind: Database["public"]["Enums"]["channel_kind"]
          name: string
          project_id: string | null
          task_id: string | null
          team_id: string | null
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          direct_key?: string | null
          id?: string
          is_private?: boolean
          kind: Database["public"]["Enums"]["channel_kind"]
          name: string
          project_id?: string | null
          task_id?: string | null
          team_id?: string | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          direct_key?: string | null
          id?: string
          is_private?: boolean
          kind?: Database["public"]["Enums"]["channel_kind"]
          name?: string
          project_id?: string | null
          task_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          id: string
          items: Json
          key: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          id?: string
          items?: Json
          key: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          id?: string
          items?: Json
          key?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_portal_users: {
        Row: {
          client_id: string
          contact_id: string | null
          id: string
          invited_at: string
          invited_by: string | null
          last_login_at: string | null
          permissions: Json
          status: string
          user_id: string
        }
        Insert: {
          client_id: string
          contact_id?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_login_at?: string | null
          permissions?: Json
          status?: string
          user_id: string
        }
        Update: {
          client_id?: string
          contact_id?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_login_at?: string | null
          permissions?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_users_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager_id: string | null
          account_status: Database["public"]["Enums"]["account_status"]
          address: string | null
          archived_at: string | null
          archived_by: string | null
          branch_id: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          crm_stage: Database["public"]["Enums"]["crm_stage"]
          default_currency: string | null
          email: string
          id: string
          industry: string | null
          name: string
          normalized_email: string | null
          notes: string | null
          phone: string | null
          primary_contact_id: string | null
          source_lead_id: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager_id?: string | null
          account_status?: Database["public"]["Enums"]["account_status"]
          address?: string | null
          archived_at?: string | null
          archived_by?: string | null
          branch_id?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          crm_stage?: Database["public"]["Enums"]["crm_stage"]
          default_currency?: string | null
          email: string
          id?: string
          industry?: string | null
          name: string
          normalized_email?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_id?: string | null
          source_lead_id?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager_id?: string | null
          account_status?: Database["public"]["Enums"]["account_status"]
          address?: string | null
          archived_at?: string | null
          archived_by?: string | null
          branch_id?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          crm_stage?: Database["public"]["Enums"]["crm_stage"]
          default_currency?: string | null
          email?: string
          id?: string
          industry?: string | null
          name?: string
          normalized_email?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_id?: string | null
          source_lead_id?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_default_currency_fkey"
            columns: ["default_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "clients_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_contact_id: string | null
          author_user_id: string | null
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_internal: boolean
          parent_id: string | null
        }
        Insert: {
          author_contact_id?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_internal?: boolean
          parent_id?: string | null
        }
        Update: {
          author_contact_id?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_internal?: boolean
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          basis: string
          created_at: string
          created_by: string | null
          currency: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          name: string
          priority: number
          product_id: string | null
          rate: number | null
          role_id: string | null
          trigger: Database["public"]["Enums"]["commission_trigger"]
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          basis?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          name: string
          priority?: number
          product_id?: string | null
          rate?: number | null
          role_id?: string | null
          trigger?: Database["public"]["Enums"]["commission_trigger"]
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          basis?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          name?: string
          priority?: number
          product_id?: string | null
          rate?: number | null
          role_id?: string | null
          trigger?: Database["public"]["Enums"]["commission_trigger"]
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          created_at: string
          currency: string
          deal_id: string
          eligible_amount: number
          eligible_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          rule_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          created_at?: string
          currency: string
          deal_id: string
          eligible_amount?: number
          eligible_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          created_at?: string
          currency?: string
          deal_id?: string
          eligible_amount?: number
          eligible_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      company_accounts: {
        Row: {
          account_type: string
          app_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          identifier: string
          last_access_at: string | null
          last_reviewed_at: string | null
          mfa_method: string | null
          mfa_status: Database["public"]["Enums"]["mfa_status"]
          mfa_verified_at: string | null
          notes: string | null
          owner_user_id: string | null
          provider: string
          recovery_owner_user_id: string | null
          status: Database["public"]["Enums"]["access_status"]
          updated_at: string
        }
        Insert: {
          account_type?: string
          app_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          identifier: string
          last_access_at?: string | null
          last_reviewed_at?: string | null
          mfa_method?: string | null
          mfa_status?: Database["public"]["Enums"]["mfa_status"]
          mfa_verified_at?: string | null
          notes?: string | null
          owner_user_id?: string | null
          provider: string
          recovery_owner_user_id?: string | null
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
        }
        Update: {
          account_type?: string
          app_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          identifier?: string
          last_access_at?: string | null
          last_reviewed_at?: string | null
          mfa_method?: string | null
          mfa_status?: Database["public"]["Enums"]["mfa_status"]
          mfa_verified_at?: string | null
          notes?: string | null
          owner_user_id?: string | null
          provider?: string
          recovery_owner_user_id?: string | null
          status?: Database["public"]["Enums"]["access_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_accounts_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "external_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived_at: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_decision_maker: boolean
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_decision_maker?: boolean
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_decision_maker?: boolean
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ai_drafts: {
        Row: {
          accepted_into: string | null
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          item_id: string | null
          kind: string
          model: string | null
          output: string
          provider: string | null
          status: string
        }
        Insert: {
          accepted_into?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          item_id?: string | null
          kind: string
          model?: string | null
          output: string
          provider?: string | null
          status?: string
        }
        Update: {
          accepted_into?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          item_id?: string | null
          kind?: string
          model?: string | null
          output?: string
          provider?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ai_drafts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: string | null
          branch_id: string | null
          content_type: string
          created_at: string
          created_by: string | null
          cta: string | null
          deadline: string | null
          description: string | null
          final_version: string | null
          goal: string | null
          hook: string | null
          id: string
          key_message: string | null
          notes: string | null
          number: string
          owner_id: string | null
          platforms: string[]
          priority: string
          publish_date: string | null
          published_links: string[]
          review_note: string | null
          script: string | null
          stage: string
          tags: string[]
          title: string
          topic: string | null
          updated_at: string
          video_length_sec: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string | null
          branch_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          deadline?: string | null
          description?: string | null
          final_version?: string | null
          goal?: string | null
          hook?: string | null
          id?: string
          key_message?: string | null
          notes?: string | null
          number?: string
          owner_id?: string | null
          platforms?: string[]
          priority?: string
          publish_date?: string | null
          published_links?: string[]
          review_note?: string | null
          script?: string | null
          stage?: string
          tags?: string[]
          title: string
          topic?: string | null
          updated_at?: string
          video_length_sec?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string | null
          branch_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          deadline?: string | null
          description?: string | null
          final_version?: string | null
          goal?: string | null
          hook?: string | null
          id?: string
          key_message?: string | null
          notes?: string | null
          number?: string
          owner_id?: string | null
          platforms?: string[]
          priority?: string
          publish_date?: string | null
          published_links?: string[]
          review_note?: string | null
          script?: string | null
          stage?: string
          tags?: string[]
          title?: string
          topic?: string | null
          updated_at?: string
          video_length_sec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_stage_fkey"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "content_stages"
            referencedColumns: ["key"]
          },
        ]
      }
      content_stages: {
        Row: {
          is_active: boolean
          is_core: boolean
          is_review: boolean
          key: string
          name: string
          requires_approval: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          is_active?: boolean
          is_core?: boolean
          is_review?: boolean
          key: string
          name: string
          requires_approval?: boolean
          sort_order: number
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          is_core?: boolean
          is_review?: boolean
          key?: string
          name?: string
          requires_approval?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_date: string | null
          id: string
          item_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          item_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          item_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contact_id: string | null
          contract_id: string
          document_version: number
          id: string
          ip: unknown
          is_valid: boolean
          method: string
          provider_reference: string | null
          recorded_by: string | null
          signed_at: string
          signer_email: string | null
          signer_name: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          contract_id: string
          document_version: number
          id?: string
          ip?: unknown
          is_valid?: boolean
          method?: string
          provider_reference?: string | null
          recorded_by?: string | null
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          contract_id?: string
          document_version?: number
          id?: string
          ip?: unknown
          is_valid?: boolean
          method?: string
          provider_reference?: string | null
          recorded_by?: string | null
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          archived_at: string | null
          client_id: string
          contract_number: string
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          document_version: number
          end_date: string | null
          esign_provider: string | null
          esign_reference: string | null
          file_id: string | null
          id: string
          payment_terms: string | null
          project_id: string | null
          proposal_id: string | null
          required_signers: number
          sent_at: string | null
          signed_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at: string
          value: number
          viewed_at: string | null
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          contract_number?: string
          created_at?: string
          created_by?: string | null
          currency: string
          deal_id?: string | null
          document_version?: number
          end_date?: string | null
          esign_provider?: string | null
          esign_reference?: string | null
          file_id?: string | null
          id?: string
          payment_terms?: string | null
          project_id?: string | null
          proposal_id?: string | null
          required_signers?: number
          sent_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at?: string
          value?: number
          viewed_at?: string | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          contract_number?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          document_version?: number
          end_date?: string | null
          esign_provider?: string | null
          esign_reference?: string | null
          file_id?: string | null
          id?: string
          payment_terms?: string | null
          project_id?: string | null
          proposal_id?: string | null
          required_signers?: number
          sent_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          updated_at?: string
          value?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          ai_sources: Json | null
          attachments: Json
          author_kind: string
          author_user_id: string | null
          body: string
          channel: string
          conversation_id: string
          created_at: string
          delivery_error: string | null
          delivery_status: string | null
          direction: string
          external_id: string | null
          id: string
        }
        Insert: {
          ai_sources?: Json | null
          attachments?: Json
          author_kind: string
          author_user_id?: string | null
          body: string
          channel: string
          conversation_id: string
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          direction: string
          external_id?: string | null
          id?: string
        }
        Update: {
          ai_sources?: Json | null
          attachments?: Json
          author_kind?: string
          author_user_id?: string | null
          body?: string
          channel?: string
          conversation_id?: string
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          direction?: string
          external_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_active: boolean
          ai_agent_id: string | null
          ai_turns: number
          assignee_id: string | null
          branch_id: string | null
          channel: string
          client_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          external_thread_id: string | null
          first_response_at: string | null
          handed_off_at: string | null
          id: string
          last_agent_message_at: string | null
          last_customer_message_at: string | null
          last_message_at: string
          number: string
          priority: string
          reopened_count: number
          resolved_at: string | null
          snoozed_until: string | null
          spam_at: string | null
          spam_by: string | null
          spam_reason: string | null
          status: string
          subject: string | null
          tags: string[]
          team_id: string | null
          ticket_id: string | null
          unread_for_agent: number
          updated_at: string
          widget_id: string | null
        }
        Insert: {
          ai_active?: boolean
          ai_agent_id?: string | null
          ai_turns?: number
          assignee_id?: string | null
          branch_id?: string | null
          channel: string
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          external_thread_id?: string | null
          first_response_at?: string | null
          handed_off_at?: string | null
          id?: string
          last_agent_message_at?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string
          number?: string
          priority?: string
          reopened_count?: number
          resolved_at?: string | null
          snoozed_until?: string | null
          spam_at?: string | null
          spam_by?: string | null
          spam_reason?: string | null
          status?: string
          subject?: string | null
          tags?: string[]
          team_id?: string | null
          ticket_id?: string | null
          unread_for_agent?: number
          updated_at?: string
          widget_id?: string | null
        }
        Update: {
          ai_active?: boolean
          ai_agent_id?: string | null
          ai_turns?: number
          assignee_id?: string | null
          branch_id?: string | null
          channel?: string
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          external_thread_id?: string | null
          first_response_at?: string | null
          handed_off_at?: string | null
          id?: string
          last_agent_message_at?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string
          number?: string
          priority?: string
          reopened_count?: number
          resolved_at?: string | null
          snoozed_until?: string | null
          spam_at?: string | null
          spam_by?: string | null
          spam_reason?: string | null
          status?: string
          subject?: string | null
          tags?: string[]
          team_id?: string | null
          ticket_id?: string | null
          unread_for_agent?: number
          updated_at?: string
          widget_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_widget_fk"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "support_widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          decimals: number
          is_active: boolean
          name: string
          symbol: string
        }
        Insert: {
          code: string
          decimals?: number
          is_active?: boolean
          name: string
          symbol: string
        }
        Update: {
          code?: string
          decimals?: number
          is_active?: boolean
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          id: string
          role_id: string | null
          updated_at: string
          user_id: string | null
          widgets: Json
        }
        Insert: {
          id?: string
          role_id?: string | null
          updated_at?: string
          user_id?: string | null
          widgets?: Json
        }
        Update: {
          id?: string
          role_id?: string | null
          updated_at?: string
          user_id?: string | null
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_products: {
        Row: {
          deal_id: string
          description: string | null
          id: string
          line_total: number | null
          product_id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          deal_id: string
          description?: string | null
          id?: string
          line_total?: number | null
          product_id: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          deal_id?: string
          description?: string | null
          id?: string
          line_total?: number | null
          product_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_risks: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          kind: string
          resolved_at: string | null
          resolved_by: string | null
          text: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          kind: string
          resolved_at?: string | null
          resolved_by?: string | null
          text: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          kind?: string
          resolved_at?: string | null
          resolved_by?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_risks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assigned_to: string | null
          branch_id: string | null
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_number: string
          expected_close_date: string | null
          id: string
          is_upsell: boolean
          lead_id: string | null
          lost_at: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["deal_payment_status"]
          payment_terms: Json
          pipeline_id: string
          previous_deal_id: string | null
          previous_project_id: string | null
          probability: number
          scope: string | null
          source_id: string | null
          stage_id: string
          updated_at: string
          value: number
          won_at: string | null
          won_processed_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deal_number?: string
          expected_close_date?: string | null
          id?: string
          is_upsell?: boolean
          lead_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["deal_payment_status"]
          payment_terms?: Json
          pipeline_id: string
          previous_deal_id?: string | null
          previous_project_id?: string | null
          probability?: number
          scope?: string | null
          source_id?: string | null
          stage_id: string
          updated_at?: string
          value?: number
          won_at?: string | null
          won_processed_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_number?: string
          expected_close_date?: string | null
          id?: string
          is_upsell?: boolean
          lead_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["deal_payment_status"]
          payment_terms?: Json
          pipeline_id?: string
          previous_deal_id?: string | null
          previous_project_id?: string | null
          probability?: number
          scope?: string | null
          source_id?: string | null
          stage_id?: string
          updated_at?: string
          value?: number
          won_at?: string | null
          won_processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_previous_deal_id_fkey"
            columns: ["previous_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_previous_project_fk"
            columns: ["previous_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          archived_at: string | null
          branch_id: string | null
          created_at: string
          id: string
          manager_user_id: string | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      device_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          condition_in: string | null
          condition_out: string | null
          confirmed_by_employee_at: string | null
          device_id: string
          employee_id: string
          id: string
          returned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          condition_in?: string | null
          condition_out?: string | null
          confirmed_by_employee_at?: string | null
          device_id: string
          employee_id: string
          id?: string
          returned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          condition_in?: string | null
          condition_out?: string | null
          confirmed_by_employee_at?: string | null
          device_id?: string
          employee_id?: string
          id?: string
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          antivirus_enabled: boolean | null
          asset_id: string
          assigned_at: string | null
          assigned_employee_id: string | null
          branch_id: string | null
          company_account_configured: boolean | null
          condition: string
          created_at: string
          currency: string | null
          encryption_enabled: boolean | null
          id: string
          last_security_check_at: string | null
          license_account: string | null
          license_expiry: string | null
          license_seats: number | null
          location: string | null
          mdm_provider: string | null
          mdm_reference: string | null
          min_quantity: number | null
          model: string | null
          name: string | null
          next_maintenance_date: string | null
          notes: string | null
          os: string | null
          os_updated: boolean | null
          purchase_date: string | null
          purchase_value: number | null
          quantity: number
          return_status: string
          screen_lock_enabled: boolean | null
          security_status: Database["public"]["Enums"]["device_security_status"]
          serial_number: string | null
          status: Database["public"]["Enums"]["device_status"]
          type: Database["public"]["Enums"]["device_type"]
          updated_at: string
          vendor_id: string | null
          warranty_until: string | null
        }
        Insert: {
          antivirus_enabled?: boolean | null
          asset_id: string
          assigned_at?: string | null
          assigned_employee_id?: string | null
          branch_id?: string | null
          company_account_configured?: boolean | null
          condition?: string
          created_at?: string
          currency?: string | null
          encryption_enabled?: boolean | null
          id?: string
          last_security_check_at?: string | null
          license_account?: string | null
          license_expiry?: string | null
          license_seats?: number | null
          location?: string | null
          mdm_provider?: string | null
          mdm_reference?: string | null
          min_quantity?: number | null
          model?: string | null
          name?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          os?: string | null
          os_updated?: boolean | null
          purchase_date?: string | null
          purchase_value?: number | null
          quantity?: number
          return_status?: string
          screen_lock_enabled?: boolean | null
          security_status?: Database["public"]["Enums"]["device_security_status"]
          serial_number?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          type: Database["public"]["Enums"]["device_type"]
          updated_at?: string
          vendor_id?: string | null
          warranty_until?: string | null
        }
        Update: {
          antivirus_enabled?: boolean | null
          asset_id?: string
          assigned_at?: string | null
          assigned_employee_id?: string | null
          branch_id?: string | null
          company_account_configured?: boolean | null
          condition?: string
          created_at?: string
          currency?: string | null
          encryption_enabled?: boolean | null
          id?: string
          last_security_check_at?: string | null
          license_account?: string | null
          license_expiry?: string | null
          license_seats?: number | null
          location?: string | null
          mdm_provider?: string | null
          mdm_reference?: string | null
          min_quantity?: number | null
          model?: string | null
          name?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          os?: string | null
          os_updated?: boolean | null
          purchase_date?: string | null
          purchase_value?: number | null
          quantity?: number
          return_status?: string
          screen_lock_enabled?: boolean | null
          security_status?: Database["public"]["Enums"]["device_security_status"]
          serial_number?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          type?: Database["public"]["Enums"]["device_type"]
          updated_at?: string
          vendor_id?: string | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          key: string
          next_value: number
          padding: number
          prefix: string
        }
        Insert: {
          key: string
          next_value?: number
          padding?: number
          prefix: string
        }
        Update: {
          key?: string
          next_value?: number
          padding?: number
          prefix?: string
        }
        Relationships: []
      }
      document_template_versions: {
        Row: {
          body: string
          change_note: string | null
          created_at: string
          created_by: string | null
          footer_note: string | null
          header_note: string | null
          id: string
          style: Json
          subject: string | null
          template_id: string
          version: number
        }
        Insert: {
          body: string
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          footer_note?: string | null
          header_note?: string | null
          id?: string
          style?: Json
          subject?: string | null
          template_id: string
          version: number
        }
        Update: {
          body?: string
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          footer_note?: string | null
          header_note?: string | null
          id?: string
          style?: Json
          subject?: string | null
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          doc_type: string
          edit_role_keys: string[]
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          language: string
          module: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          doc_type: string
          edit_role_keys?: string[]
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          language: string
          module?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          doc_type?: string
          edit_role_keys?: string[]
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          language?: string
          module?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          alert_days_before: number
          category: string
          created_at: string
          employee_can_upload: boolean
          id: string
          is_active: boolean
          key: string
          name: string
          required_for_onboarding: boolean
          requires_expiry: boolean
          sort_order: number
          visible_to_employee: boolean
          visible_to_manager: boolean
        }
        Insert: {
          alert_days_before?: number
          category: string
          created_at?: string
          employee_can_upload?: boolean
          id?: string
          is_active?: boolean
          key: string
          name: string
          required_for_onboarding?: boolean
          requires_expiry?: boolean
          sort_order?: number
          visible_to_employee?: boolean
          visible_to_manager?: boolean
        }
        Update: {
          alert_days_before?: number
          category?: string
          created_at?: string
          employee_can_upload?: boolean
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          required_for_onboarding?: boolean
          requires_expiry?: boolean
          sort_order?: number
          visible_to_employee?: boolean
          visible_to_manager?: boolean
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_addresses: string[]
          contact_id: string | null
          created_at: string
          direction: string
          from_address: string
          id: string
          is_important: boolean
          provider_message_id: string | null
          sent_at: string
          subject: string | null
          thread_id: string
          to_addresses: string[]
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[]
          contact_id?: string | null
          created_at?: string
          direction: string
          from_address: string
          id?: string
          is_important?: boolean
          provider_message_id?: string | null
          sent_at: string
          subject?: string | null
          thread_id: string
          to_addresses?: string[]
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[]
          contact_id?: string | null
          created_at?: string
          direction?: string
          from_address?: string
          id?: string
          is_important?: boolean
          provider_message_id?: string | null
          sent_at?: string
          subject?: string | null
          thread_id?: string
          to_addresses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          client_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          last_message_at: string | null
          lead_id: string | null
          project_id: string | null
          provider: string | null
          provider_thread_id: string | null
          subject: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          project_id?: string | null
          provider?: string | null
          provider_thread_id?: string | null
          subject?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          project_id?: string | null
          provider?: string | null
          provider_thread_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_bonuses: {
        Row: {
          amount: number
          bonus_type: string
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          employee_id: string
          id: string
          pay_period: string
          payslip_id: string | null
          reason: string
          requested_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          bonus_type: string
          created_at?: string
          currency: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          employee_id: string
          id?: string
          pay_period: string
          payslip_id?: string | null
          reason: string
          requested_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          bonus_type?: string
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          employee_id?: string
          id?: string
          pay_period?: string
          payslip_id?: string | null
          reason?: string
          requested_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_bonuses_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "employee_bonuses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_bonuses_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      employee_compensation: {
        Row: {
          approval_status: string
          basic_salary: number
          change_type: string
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          effective_from: string
          employee_id: string
          id: string
          pay_frequency: string
          reason: string | null
          review_id: string | null
        }
        Insert: {
          approval_status?: string
          basic_salary: number
          change_type?: string
          created_at?: string
          created_by?: string | null
          currency: string
          decided_at?: string | null
          decided_by?: string | null
          effective_from: string
          employee_id: string
          id?: string
          pay_frequency?: string
          reason?: string | null
          review_id?: string | null
        }
        Update: {
          approval_status?: string
          basic_salary?: number
          change_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          effective_from?: string
          employee_id?: string
          id?: string
          pay_frequency?: string
          reason?: string | null
          review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "employee_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensation_review_fk"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contracts: {
        Row: {
          basic_salary: number | null
          company_signed_at: string | null
          contract_number: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          currency: string | null
          employee_id: string
          employee_signed_at: string | null
          end_date: string | null
          expiry_alerted_at: string | null
          id: string
          notes: string | null
          notice_period_days: number | null
          parent_id: string | null
          position_title: string | null
          signature_status: string
          start_date: string
          status: string
          terminated_at: string | null
          termination_reason: string | null
          terms: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          basic_salary?: number | null
          company_signed_at?: string | null
          contract_number?: string | null
          contract_type: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          employee_id: string
          employee_signed_at?: string | null
          end_date?: string | null
          expiry_alerted_at?: string | null
          id?: string
          notes?: string | null
          notice_period_days?: number | null
          parent_id?: string | null
          position_title?: string | null
          signature_status?: string
          start_date: string
          status?: string
          terminated_at?: string | null
          termination_reason?: string | null
          terms?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          basic_salary?: number | null
          company_signed_at?: string | null
          contract_number?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          employee_id?: string
          employee_signed_at?: string | null
          end_date?: string | null
          expiry_alerted_at?: string | null
          id?: string
          notes?: string | null
          notice_period_days?: number | null
          parent_id?: string | null
          position_title?: string | null
          signature_status?: string
          start_date?: string
          status?: string
          terminated_at?: string | null
          termination_reason?: string | null
          terms?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_contracts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "employee_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contracts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "employee_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_days_off: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          department_id: string | null
          employee_id: string | null
          id: string
          reason: string
          scope: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          reason: string
          scope: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          reason?: string
          scope?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_days_off_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_days_off_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_days_off_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          confidential: boolean
          created_at: string
          document_number: string | null
          document_type_id: string
          employee_id: string
          expiry_alerted_at: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          notes: string | null
          rejection_reason: string | null
          status: string
          title: string
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          confidential?: boolean
          created_at?: string
          document_number?: string | null
          document_type_id: string
          employee_id: string
          expiry_alerted_at?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          confidential?: boolean
          created_at?: string
          document_number?: string | null
          document_type_id?: string
          employee_id?: string
          expiry_alerted_at?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_job_history: {
        Row: {
          change_type: string
          compensation_id: string | null
          created_at: string
          created_by: string | null
          effective_date: string
          employee_id: string
          from_department_id: string | null
          from_manager_id: string | null
          from_position: string | null
          from_team_id: string | null
          id: string
          reason: string | null
          review_id: string | null
          to_department_id: string | null
          to_manager_id: string | null
          to_position: string | null
          to_team_id: string | null
        }
        Insert: {
          change_type: string
          compensation_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_date: string
          employee_id: string
          from_department_id?: string | null
          from_manager_id?: string | null
          from_position?: string | null
          from_team_id?: string | null
          id?: string
          reason?: string | null
          review_id?: string | null
          to_department_id?: string | null
          to_manager_id?: string | null
          to_position?: string | null
          to_team_id?: string | null
        }
        Update: {
          change_type?: string
          compensation_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string
          employee_id?: string
          from_department_id?: string | null
          from_manager_id?: string | null
          from_position?: string | null
          from_team_id?: string | null
          id?: string
          reason?: string | null
          review_id?: string | null
          to_department_id?: string | null
          to_manager_id?: string | null
          to_position?: string | null
          to_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_job_history_compensation_id_fkey"
            columns: ["compensation_id"]
            isOneToOne: false
            referencedRelation: "employee_compensation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_from_manager_id_fkey"
            columns: ["from_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_review_fk"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_to_manager_id_fkey"
            columns: ["to_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_history_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          amount: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          disbursed_at: string | null
          disbursement_reference: string | null
          employee_id: string
          id: string
          installment_amount: number
          installments: number
          loan_number: string | null
          loan_type: string
          notes: string | null
          reason: string
          requested_by: string | null
          settled_at: string | null
          start_period: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          disbursed_at?: string | null
          disbursement_reference?: string | null
          employee_id: string
          id?: string
          installment_amount: number
          installments: number
          loan_number?: string | null
          loan_type: string
          notes?: string | null
          reason: string
          requested_by?: string | null
          settled_at?: string | null
          start_period: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          disbursed_at?: string | null
          disbursement_reference?: string | null
          employee_id?: string
          id?: string
          installment_amount?: number
          installments?: number
          loan_number?: string | null
          loan_type?: string
          notes?: string | null
          reason?: string
          requested_by?: string | null
          settled_at?: string | null
          start_period?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_locations: {
        Row: {
          accuracy_m: number | null
          address: string | null
          attendance_record_id: string | null
          branch_id: string | null
          captured_at: string
          distance_to_branch_m: number | null
          employee_id: string
          event: string
          id: string
          latitude: number
          longitude: number
          task_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          address?: string | null
          attendance_record_id?: string | null
          branch_id?: string | null
          captured_at?: string
          distance_to_branch_m?: number | null
          employee_id: string
          event: string
          id?: string
          latitude: number
          longitude: number
          task_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          address?: string | null
          attendance_record_id?: string | null
          branch_id?: string | null
          captured_at?: string
          distance_to_branch_m?: number | null
          employee_id?: string
          event?: string
          id?: string
          latitude?: number
          longitude?: number
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_locations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_private: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employee_id: string
          gender: string | null
          hr_notes: string | null
          insurance_number: string | null
          insurance_start_date: string | null
          marital_status: string | null
          national_id: string | null
          national_id_expiry: string | null
          nationality: string | null
          passport_expiry: string | null
          passport_number: string | null
          tax_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id: string
          gender?: string | null
          hr_notes?: string | null
          insurance_number?: string | null
          insurance_start_date?: string | null
          marital_status?: string | null
          national_id?: string | null
          national_id_expiry?: string | null
          nationality?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string
          gender?: string | null
          hr_notes?: string | null
          insurance_number?: string | null
          insurance_start_date?: string | null
          marital_status?: string | null
          national_id?: string | null
          national_id_expiry?: string | null
          nationality?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_private_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_components: {
        Row: {
          amount: number
          component_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          component_id: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          component_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_separations: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          exit_interview_at: string | null
          exit_interview_by: string | null
          exit_interview_notes: string | null
          final_settlement_payslip_id: string | null
          id: string
          initiated_by: string | null
          last_working_day: string | null
          notice_date: string | null
          reason: string | null
          rehire_eligible: boolean | null
          separation_type: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          exit_interview_at?: string | null
          exit_interview_by?: string | null
          exit_interview_notes?: string | null
          final_settlement_payslip_id?: string | null
          id?: string
          initiated_by?: string | null
          last_working_day?: string | null
          notice_date?: string | null
          reason?: string | null
          rehire_eligible?: boolean | null
          separation_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          exit_interview_at?: string | null
          exit_interview_by?: string | null
          exit_interview_notes?: string | null
          final_settlement_payslip_id?: string | null
          id?: string
          initiated_by?: string | null
          last_working_day?: string | null
          notice_date?: string | null
          reason?: string | null
          rehire_eligible?: boolean | null
          separation_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_separations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_separations_final_payslip_fk"
            columns: ["final_settlement_payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          archived_at: string | null
          branch_id: string | null
          career_application_id: string | null
          category_id: string | null
          certifications: string | null
          cost_currency: string | null
          country: string | null
          created_at: string
          department_id: string | null
          email: string | null
          employee_code: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          experience_years: number | null
          full_name: string
          hourly_cost: number | null
          hourly_cost_source: string
          id: string
          is_remote: boolean
          last_activity_at: string | null
          lifecycle_status: Database["public"]["Enums"]["employee_lifecycle_status"]
          manager_id: string | null
          mfa_status: Database["public"]["Enums"]["mfa_status"]
          personal_email: string | null
          phone: string | null
          photo_path: string | null
          photo_updated_at: string | null
          position: string | null
          probation_end_date: string | null
          probation_status: string
          profile_notes: string | null
          qualifications: string | null
          skills: string[]
          start_date: string | null
          team_id: string | null
          timezone: string
          updated_at: string
          user_id: string | null
          work_location: string | null
          work_schedule_id: string | null
        }
        Insert: {
          archived_at?: string | null
          branch_id?: string | null
          career_application_id?: string | null
          category_id?: string | null
          certifications?: string | null
          cost_currency?: string | null
          country?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_code?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          experience_years?: number | null
          full_name: string
          hourly_cost?: number | null
          hourly_cost_source?: string
          id?: string
          is_remote?: boolean
          last_activity_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["employee_lifecycle_status"]
          manager_id?: string | null
          mfa_status?: Database["public"]["Enums"]["mfa_status"]
          personal_email?: string | null
          phone?: string | null
          photo_path?: string | null
          photo_updated_at?: string | null
          position?: string | null
          probation_end_date?: string | null
          probation_status?: string
          profile_notes?: string | null
          qualifications?: string | null
          skills?: string[]
          start_date?: string | null
          team_id?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
          work_schedule_id?: string | null
        }
        Update: {
          archived_at?: string | null
          branch_id?: string | null
          career_application_id?: string | null
          category_id?: string | null
          certifications?: string | null
          cost_currency?: string | null
          country?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_code?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          experience_years?: number | null
          full_name?: string
          hourly_cost?: number | null
          hourly_cost_source?: string
          id?: string
          is_remote?: boolean
          last_activity_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["employee_lifecycle_status"]
          manager_id?: string | null
          mfa_status?: Database["public"]["Enums"]["mfa_status"]
          personal_email?: string | null
          phone?: string | null
          photo_path?: string | null
          photo_updated_at?: string | null
          position?: string | null
          probation_end_date?: string | null
          probation_status?: string
          profile_notes?: string | null
          qualifications?: string | null
          skills?: string[]
          start_date?: string | null
          team_id?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_career_application_id_fkey"
            columns: ["career_application_id"]
            isOneToOne: false
            referencedRelation: "career_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "employee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_cost_currency_fkey"
            columns: ["cost_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          quote: string
          rate: number
          source: string | null
        }
        Insert: {
          base: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          quote: string
          rate: number
          source?: string | null
        }
        Update: {
          base?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          quote?: string
          rate?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_base_fkey"
            columns: ["base"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_quote_fkey"
            columns: ["quote"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      expense_categories: {
        Row: {
          cost_type: Database["public"]["Enums"]["cost_type"]
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          cost_type?: Database["public"]["Enums"]["cost_type"]
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          cost_type?: Database["public"]["Enums"]["cost_type"]
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          branch_id: string | null
          category_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          employee_user_id: string | null
          expense_date: string
          expense_kind: string | null
          id: string
          payslip_id: string | null
          project_id: string | null
          receipt_file_id: string | null
          reimbursable: boolean
          reimbursed_at: string | null
          reimbursement_method: string | null
          reimbursement_reference: string | null
          reimbursement_status: string
          source_id: string | null
          source_type: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          branch_id?: string | null
          category_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          description: string
          employee_user_id?: string | null
          expense_date?: string
          expense_kind?: string | null
          id?: string
          payslip_id?: string | null
          project_id?: string | null
          receipt_file_id?: string | null
          reimbursable?: boolean
          reimbursed_at?: string | null
          reimbursement_method?: string | null
          reimbursement_reference?: string | null
          reimbursement_status?: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          branch_id?: string | null
          category_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          employee_user_id?: string | null
          expense_date?: string
          expense_kind?: string | null
          id?: string
          payslip_id?: string | null
          project_id?: string | null
          receipt_file_id?: string | null
          reimbursable?: boolean
          reimbursed_at?: string | null
          reimbursement_method?: string | null
          reimbursement_reference?: string | null
          reimbursement_status?: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "expenses_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      external_apps: {
        Row: {
          access_levels: string[]
          admin_user_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_sensitive: boolean
          key: string
          name: string
          owner_user_id: string | null
          password_vault: string | null
          provider: string | null
          requires_mfa: boolean
          security_requirements: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          access_levels?: string[]
          admin_user_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          key: string
          name: string
          owner_user_id?: string | null
          password_vault?: string | null
          provider?: string | null
          requires_mfa?: boolean
          security_requirements?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          access_levels?: string[]
          admin_user_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          key?: string
          name?: string
          owner_user_id?: string | null
          password_vault?: string | null
          provider?: string | null
          requires_mfa?: boolean
          security_requirements?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_ar: string
          answer_en: string
          created_at: string
          id: string
          is_active: boolean
          question_ar: string
          question_en: string
          sort_order: number
        }
        Insert: {
          answer_ar: string
          answer_en: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_ar: string
          question_en: string
          sort_order?: number
        }
        Update: {
          answer_ar?: string
          answer_en?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_ar?: string
          question_en?: string
          sort_order?: number
        }
        Relationships: []
      }
      file_shares: {
        Row: {
          created_at: string
          created_by: string | null
          file_id: string
          id: string
          permission: string
          shared_with_client_id: string | null
          shared_with_role_id: string | null
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_id: string
          id?: string
          permission?: string
          shared_with_client_id?: string | null
          shared_with_role_id?: string | null
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_id?: string
          id?: string
          permission?: string
          shared_with_client_id?: string | null
          shared_with_role_id?: string | null
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_shares_shared_with_client_id_fkey"
            columns: ["shared_with_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_shares_shared_with_role_id_fkey"
            columns: ["shared_with_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          client_visible: boolean
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          folder: string
          id: string
          is_finalized: boolean
          is_latest: boolean
          is_template: boolean
          mime_type: string | null
          name: string
          previous_version_id: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          client_visible?: boolean
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          folder?: string
          id?: string
          is_finalized?: boolean
          is_latest?: boolean
          is_template?: boolean
          mime_type?: string | null
          name: string
          previous_version_id?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          client_visible?: boolean
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          folder?: string
          id?: string
          is_finalized?: boolean
          is_latest?: boolean
          is_template?: boolean
          mime_type?: string | null
          name?: string
          previous_version_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "files_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string | null
          data_snapshot: Json
          doc_type: string
          docx_path: string | null
          entity_id: string
          entity_type: string
          id: string
          language: string
          markup: string
          number: string
          reference: string | null
          rendered_html: string
          sent_at: string | null
          sent_to: string[] | null
          status: string
          style: Json
          template_id: string | null
          template_version_id: string | null
          title: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by?: string | null
          data_snapshot: Json
          doc_type: string
          docx_path?: string | null
          entity_id: string
          entity_type: string
          id?: string
          language: string
          markup: string
          number?: string
          reference?: string | null
          rendered_html: string
          sent_at?: string | null
          sent_to?: string[] | null
          status?: string
          style: Json
          template_id?: string | null
          template_version_id?: string | null
          title: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string | null
          data_snapshot?: Json
          doc_type?: string
          docx_path?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          language?: string
          markup?: string
          number?: string
          reference?: string | null
          rendered_html?: string
          sent_at?: string | null
          sent_to?: string[] | null
          status?: string
          style?: Json
          template_id?: string | null
          template_version_id?: string | null
          title?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "document_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          branch_id: string | null
          country: string | null
          created_at: string
          date: string
          id: string
          is_paid: boolean
          kind: string
          name: string
          notes: string | null
        }
        Insert: {
          branch_id?: string | null
          country?: string | null
          created_at?: string
          date: string
          id?: string
          is_paid?: boolean
          kind?: string
          name: string
          notes?: string | null
        }
        Update: {
          branch_id?: string | null
          country?: string | null
          created_at?: string
          date?: string
          id?: string
          is_paid?: boolean
          kind?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_request_types: {
        Row: {
          approval_steps: string[]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          requires_attachment: boolean
          sort_order: number
        }
        Insert: {
          approval_steps?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          requires_attachment?: boolean
          sort_order?: number
        }
        Update: {
          approval_steps?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          requires_attachment?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      hr_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          details: string | null
          due_date: string | null
          employee_id: string
          handled_by: string | null
          id: string
          request_number: string | null
          response: string | null
          status: string
          subject: string
          type_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_date?: string | null
          employee_id: string
          handled_by?: string | null
          id?: string
          request_number?: string | null
          response?: string | null
          status?: string
          subject: string
          type_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_date?: string | null
          employee_id?: string
          handled_by?: string | null
          id?: string
          request_number?: string | null
          response?: string | null
          status?: string
          subject?: string
          type_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_requests_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "hr_request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          created_count: number
          data_type: string
          duplicate_rows: number
          error: string | null
          error_rows: number
          executed_at: string | null
          expected_count: number | null
          failed_count: number
          file_name: string
          file_size: number
          headers: string[]
          id: string
          mapping: Json
          match_key: string | null
          mode: string
          number: string
          rolled_back_at: string | null
          rolled_back_by: string | null
          skipped_count: number
          source_format: string
          status: string
          storage_path: string | null
          total_rows: number
          updated_count: number
          valid_rows: number
          validated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_count?: number
          data_type: string
          duplicate_rows?: number
          error?: string | null
          error_rows?: number
          executed_at?: string | null
          expected_count?: number | null
          failed_count?: number
          file_name: string
          file_size: number
          headers?: string[]
          id?: string
          mapping?: Json
          match_key?: string | null
          mode?: string
          number?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          skipped_count?: number
          source_format: string
          status?: string
          storage_path?: string | null
          total_rows?: number
          updated_count?: number
          valid_rows?: number
          validated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_count?: number
          data_type?: string
          duplicate_rows?: number
          error?: string | null
          error_rows?: number
          executed_at?: string | null
          expected_count?: number | null
          failed_count?: number
          file_name?: string
          file_size?: number
          headers?: string[]
          id?: string
          mapping?: Json
          match_key?: string | null
          mode?: string
          number?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          skipped_count?: number
          source_format?: string
          status?: string
          storage_path?: string | null
          total_rows?: number
          updated_count?: number
          valid_rows?: number
          validated_at?: string | null
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          before: Json | null
          errors: string[]
          id: number
          job_id: string
          match_id: string | null
          raw: Json
          row_no: number
          status: string
          target_id: string | null
          values: Json | null
        }
        Insert: {
          before?: Json | null
          errors?: string[]
          id?: number
          job_id: string
          match_id?: string | null
          raw: Json
          row_no: number
          status?: string
          target_id?: string | null
          values?: Json | null
        }
        Update: {
          before?: Json | null
          errors?: string[]
          id?: number
          job_id?: string
          match_id?: string | null
          raw?: Json
          row_no?: number
          status?: string
          target_id?: string | null
          values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          label: string
          last_error: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          provider: string
          secret_ciphertext: string | null
          secret_hint: Json
          secret_key_version: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          label: string
          last_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider: string
          secret_ciphertext?: string | null
          secret_hint?: Json
          secret_key_version?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          label?: string
          last_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider?: string
          secret_ciphertext?: string | null
          secret_hint?: Json
          secret_key_version?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          actor_user_id: string | null
          attempts: number
          connection_id: string | null
          created_at: string
          direction: string
          duration_ms: number | null
          error: string | null
          http_status: number | null
          id: number
          meta: Json
          ok: boolean
          operation: string
          provider: string
        }
        Insert: {
          actor_user_id?: string | null
          attempts?: number
          connection_id?: string | null
          created_at?: string
          direction: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: never
          meta?: Json
          ok: boolean
          operation: string
          provider: string
        }
        Update: {
          actor_user_id?: string | null
          attempts?: number
          connection_id?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: never
          meta?: Json
          ok?: boolean
          operation?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_feedback: {
        Row: {
          concerns: string | null
          created_at: string
          id: string
          interview_id: string
          notes: string | null
          rating: number
          recommendation: string
          reviewer_user_id: string
          strengths: string | null
          updated_at: string
        }
        Insert: {
          concerns?: string | null
          created_at?: string
          id?: string
          interview_id: string
          notes?: string | null
          rating: number
          recommendation: string
          reviewer_user_id: string
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          concerns?: string | null
          created_at?: string
          id?: string
          interview_id?: string
          notes?: string | null
          rating?: number
          recommendation?: string
          reviewer_user_id?: string
          strengths?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "career_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total: number | null
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          amount_refunded: number
          balance: number | null
          branch_id: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          discount_amount: number
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          overdue_notified_at: string | null
          paid_at: string | null
          payment_terms: string | null
          project_id: string | null
          schedule_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          amount_refunded?: number
          balance?: number | null
          branch_id?: string | null
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          deal_id?: string | null
          discount_amount?: number
          due_date: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          overdue_notified_at?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          project_id?: string | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          amount_refunded?: number
          balance?: number | null
          branch_id?: string | null
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          overdue_notified_at?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          project_id?: string | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "payment_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          reported_by: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          allowances: Json
          application_id: string
          basic_salary: number
          candidate_id: string
          created_at: string
          created_by: string | null
          currency: string
          department_id: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          expires_at: string
          id: string
          job_id: string
          manager_employee_id: string | null
          notes: string | null
          offer_number: string | null
          position_title: string
          probation_months: number
          responded_at: string | null
          response_note: string | null
          sent_at: string | null
          start_date: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          allowances?: Json
          application_id: string
          basic_salary: number
          candidate_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          department_id?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          expires_at: string
          id?: string
          job_id: string
          manager_employee_id?: string | null
          notes?: string | null
          offer_number?: string | null
          position_title: string
          probation_months?: number
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          start_date: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          allowances?: Json
          application_id?: string
          basic_salary?: number
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          department_id?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          expires_at?: string
          id?: string
          job_id?: string
          manager_employee_id?: string | null
          notes?: string | null
          offer_number?: string | null
          position_title?: string
          probation_months?: number
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          start_date?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "career_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "job_offers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "career_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_reads: {
        Row: {
          article_id: string
          read_at: string
          user_id: string
          version: number
        }
        Insert: {
          article_id: string
          read_at?: string
          user_id: string
          version: number
        }
        Update: {
          article_id?: string
          read_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_reads_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_versions: {
        Row: {
          article_id: string
          content: string
          created_at: string
          edited_by: string | null
          id: string
          title: string
          version: number
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          edited_by?: string | null
          id?: string
          title: string
          version: number
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          ai_allowed: boolean
          allowed_role_ids: string[] | null
          audience: string
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["kb_kind"]
          language: string
          owner_id: string | null
          playbook_section:
            | Database["public"]["Enums"]["playbook_section"]
            | null
          published_at: string | null
          required_documents: string | null
          search: unknown
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_allowed?: boolean
          allowed_role_ids?: string[] | null
          audience?: string
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["kb_kind"]
          language?: string
          owner_id?: string | null
          playbook_section?:
            | Database["public"]["Enums"]["playbook_section"]
            | null
          published_at?: string | null
          required_documents?: string | null
          search?: unknown
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_allowed?: boolean
          allowed_role_ids?: string[] | null
          audience?: string
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["kb_kind"]
          language?: string
          owner_id?: string | null
          playbook_section?:
            | Database["public"]["Enums"]["playbook_section"]
            | null
          published_at?: string | null
          required_documents?: string | null
          search?: unknown
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          id: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      kpi_assignments: {
        Row: {
          kpi_id: string
          target_override: number | null
          user_id: string
        }
        Insert: {
          kpi_id: string
          target_override?: number | null
          user_id: string
        }
        Update: {
          kpi_id?: string
          target_override?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_assignments_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_values: {
        Row: {
          actual: number | null
          computed_at: string
          id: string
          kpi_id: string
          note: string | null
          period_end: string
          period_start: string
          target: number | null
          user_id: string
        }
        Insert: {
          actual?: number | null
          computed_at?: string
          id?: string
          kpi_id: string
          note?: string | null
          period_end: string
          period_start: string
          target?: number | null
          user_id: string
        }
        Update: {
          actual?: number | null
          computed_at?: string
          id?: string
          kpi_id?: string
          note?: string | null
          period_end?: string
          period_start?: string
          target?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          calculation: string
          category: string | null
          created_at: string
          created_by: string | null
          data_source: string
          department_id: string | null
          description: string | null
          direction: string
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          period: Database["public"]["Enums"]["kpi_period"]
          role_id: string | null
          target: number
          unit: string
          updated_at: string
          weight: number | null
          weight_enabled: boolean
        }
        Insert: {
          calculation?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          data_source: string
          department_id?: string | null
          description?: string | null
          direction?: string
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          period?: Database["public"]["Enums"]["kpi_period"]
          role_id?: string | null
          target?: number
          unit?: string
          updated_at?: string
          weight?: number | null
          weight_enabled?: boolean
        }
        Update: {
          calculation?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          department_id?: string | null
          description?: string | null
          direction?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          period?: Database["public"]["Enums"]["kpi_period"]
          role_id?: string | null
          target?: number
          unit?: string
          updated_at?: string
          weight?: number | null
          weight_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kpis_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assigned_to: string | null
          booking_id: string | null
          branch_id: string | null
          budget_currency: string | null
          budget_score: number
          business_stage: string | null
          city: string | null
          client_id: string | null
          company_name: string | null
          contact_id: string | null
          contact_name: string | null
          converted_at: string | null
          converted_deal_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          current_solution: string | null
          decision_maker: string | null
          email: string | null
          engagement_score: number
          estimated_budget: number | null
          fit_score: number
          id: string
          industry: string | null
          intent_score: number
          last_activity_at: string | null
          lead_number: string
          lost_reason: string | null
          name: string
          next_activity_at: string | null
          notes: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          problem: string | null
          product_interest_id: string | null
          source_id: string | null
          stage_id: string
          team_id: string | null
          timeline: string | null
          total_score: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          booking_id?: string | null
          branch_id?: string | null
          budget_currency?: string | null
          budget_score?: number
          business_stage?: string | null
          city?: string | null
          client_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          converted_at?: string | null
          converted_deal_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_solution?: string | null
          decision_maker?: string | null
          email?: string | null
          engagement_score?: number
          estimated_budget?: number | null
          fit_score?: number
          id?: string
          industry?: string | null
          intent_score?: number
          last_activity_at?: string | null
          lead_number?: string
          lost_reason?: string | null
          name: string
          next_activity_at?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          problem?: string | null
          product_interest_id?: string | null
          source_id?: string | null
          stage_id: string
          team_id?: string | null
          timeline?: string | null
          total_score?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          booking_id?: string | null
          branch_id?: string | null
          budget_currency?: string | null
          budget_score?: number
          business_stage?: string | null
          city?: string | null
          client_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          converted_at?: string | null
          converted_deal_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_solution?: string | null
          decision_maker?: string | null
          email?: string | null
          engagement_score?: number
          estimated_budget?: number | null
          fit_score?: number
          id?: string
          industry?: string | null
          intent_score?: number
          last_activity_at?: string | null
          lead_number?: string
          lost_reason?: string | null
          name?: string
          next_activity_at?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          problem?: string | null
          product_interest_id?: string | null
          source_id?: string | null
          stage_id?: string
          team_id?: string | null
          timeline?: string | null
          total_score?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_budget_currency_fkey"
            columns: ["budget_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_deal_fk"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_interest_id_fkey"
            columns: ["product_interest_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balance_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          days: number
          id: string
          kind: string
          leave_type_id: string
          reason: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days: number
          id?: string
          kind?: string
          leave_type_id: string
          reason: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: number
          id?: string
          kind?: string
          leave_type_id?: string
          reason?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balance_adjustments_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_group_id: string | null
          approver_id: string | null
          created_at: string
          decided_at: string | null
          decision_comment: string | null
          duration_days: number
          end_date: string
          half_day: boolean
          id: string
          leave_type_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_group_id?: string | null
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_comment?: string | null
          duration_days: number
          end_date: string
          half_day?: boolean
          id?: string
          leave_type_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_group_id?: string | null
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_comment?: string | null
          duration_days?: number
          end_date?: string
          half_day?: boolean
          id?: string
          leave_type_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          annual_allowance_days: number | null
          approval_steps: string[] | null
          carry_forward_max_days: number | null
          color: string | null
          eligible_gender: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          key: string
          max_consecutive_days: number | null
          min_notice_days: number | null
          name: string
          requires_approval: boolean
          requires_reason: boolean
          sort_order: number
        }
        Insert: {
          annual_allowance_days?: number | null
          approval_steps?: string[] | null
          carry_forward_max_days?: number | null
          color?: string | null
          eligible_gender?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          key: string
          max_consecutive_days?: number | null
          min_notice_days?: number | null
          name: string
          requires_approval?: boolean
          requires_reason?: boolean
          sort_order?: number
        }
        Update: {
          annual_allowance_days?: number | null
          approval_steps?: string[] | null
          carry_forward_max_days?: number | null
          color?: string | null
          eligible_gender?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          key?: string
          max_consecutive_days?: number | null
          min_notice_days?: number | null
          name?: string
          requires_approval?: boolean
          requires_reason?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      loan_installments: {
        Row: {
          amount: number
          due_period: string
          id: string
          loan_id: string
          note: string | null
          payslip_id: string | null
          seq: number
          settled_at: string | null
          status: string
        }
        Insert: {
          amount: number
          due_period: string
          id?: string
          loan_id: string
          note?: string | null
          payslip_id?: string | null
          seq: number
          settled_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          due_period?: string
          id?: string
          loan_id?: string
          note?: string | null
          payslip_id?: string | null
          seq?: number
          settled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      location_access_log: {
        Row: {
          action: string
          employee_id: string | null
          id: number
          period: string | null
          viewed_at: string
          viewer_user_id: string
        }
        Insert: {
          action: string
          employee_id?: string | null
          id?: number
          period?: string | null
          viewed_at?: string
          viewer_user_id: string
        }
        Update: {
          action?: string
          employee_id?: string | null
          id?: number
          period?: string | null
          viewed_at?: string
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_access_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      location_consents: {
        Row: {
          employee_id: string
          granted_at: string | null
          purpose_version: number
          scope: string
          status: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          employee_id: string
          granted_at?: string | null
          purpose_version: number
          scope?: string
          status: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          employee_id?: string
          granted_at?: string | null
          purpose_version?: number
          scope?: string
          status?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_consents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          created_at: string
          email: string | null
          failure_reason: string | null
          id: number
          ip: unknown
          method: string
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: never
          ip?: unknown
          method?: string
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: never
          ip?: unknown
          method?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      manual_notifications: {
        Row: {
          body: string | null
          channels: string[]
          content_hash: string
          created_at: string
          id: string
          link: string | null
          priority: string
          recipient_count: number
          sender_id: string | null
          target_ids: string[]
          target_kind: string
          title: string
        }
        Insert: {
          body?: string | null
          channels?: string[]
          content_hash: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          recipient_count?: number
          sender_id?: string | null
          target_ids?: string[]
          target_kind: string
          title: string
        }
        Update: {
          body?: string | null
          channels?: string[]
          content_hash?: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          recipient_count?: number
          sender_id?: string | null
          target_ids?: string[]
          target_kind?: string
          title?: string
        }
        Relationships: []
      }
      meeting_attendees: {
        Row: {
          contact_id: string | null
          email: string | null
          id: string
          meeting_id: string
          response: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          email?: string | null
          id?: string
          meeting_id: string
          response?: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          email?: string | null
          id?: string
          meeting_id?: string
          response?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          booking_id: string | null
          client_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          duration_minutes: number
          follow_up_task_id: string | null
          id: string
          lead_id: string | null
          location: string | null
          meeting_link: string | null
          next_action: string | null
          notes: string | null
          organizer_id: string | null
          outcome: string | null
          project_id: string | null
          reminder_sent_at: string | null
          start_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          duration_minutes?: number
          follow_up_task_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_link?: string | null
          next_action?: string | null
          notes?: string | null
          organizer_id?: string | null
          outcome?: string | null
          project_id?: string | null
          reminder_sent_at?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          duration_minutes?: number
          follow_up_task_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_link?: string | null
          next_action?: string | null
          notes?: string | null
          organizer_id?: string | null
          outcome?: string | null
          project_id?: string | null
          reminder_sent_at?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_follow_up_task_fk"
            columns: ["follow_up_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          message_id: string
          user_id: string
        }
        Insert: {
          message_id: string
          user_id: string
        }
        Update: {
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          channel: string
          connection_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          language: string
          name: string
          provider_status: string
          provider_template_id: string | null
          synced_at: string | null
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          category?: string
          channel: string
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name: string
          provider_status?: string
          provider_template_id?: string | null
          synced_at?: string | null
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          provider_status?: string
          provider_template_id?: string | null
          synced_at?: string | null
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_contact_id: string | null
          author_user_id: string | null
          body: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          event_id: number | null
          id: string
          is_system: boolean
          linked_entity_id: string | null
          linked_entity_type: string | null
          parent_id: string | null
          search: unknown
        }
        Insert: {
          author_contact_id?: string | null
          author_user_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id?: number | null
          id?: string
          is_system?: boolean
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          parent_id?: string | null
          search?: unknown
        }
        Update: {
          author_contact_id?: string | null
          author_user_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id?: number | null
          id?: string
          is_system?: boolean
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          parent_id?: string | null
          search?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_contact_id_fkey"
            columns: ["author_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_consents: {
        Row: {
          channel: string
          created_at: string
          id: string
          note: string | null
          phone: string
          purpose: string
          source: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          note?: string | null
          phone: string
          purpose: string
          source?: string
          status: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          note?: string | null
          phone?: string
          purpose?: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      milestone_dependencies: {
        Row: {
          depends_on_id: string
          milestone_id: string
        }
        Insert: {
          depends_on_id: string
          milestone_id: string
        }
        Update: {
          depends_on_id?: string
          milestone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_dependencies_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_dependencies_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          approval_status: string
          completed_at: string | null
          created_at: string
          deliverables: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          owner_id: string | null
          progress: number
          project_id: string
          requires_client_approval: boolean
          sort_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
        }
        Insert: {
          approval_status?: string
          completed_at?: string | null
          created_at?: string
          deliverables?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          owner_id?: string | null
          progress?: number
          project_id: string
          requires_client_approval?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Update: {
          approval_status?: string
          completed_at?: string | null
          created_at?: string
          deliverables?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          progress?: number
          project_id?: string
          requires_client_approval?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string | null
          notification_id: string
          provider_message_id: string | null
          recipient: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          notification_id: string
          provider_message_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          notification_id?: string
          provider_message_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          event_type: string
          in_app: boolean
          push: boolean
          user_id: string
        }
        Insert: {
          email?: boolean
          event_type: string
          in_app?: boolean
          push?: boolean
          user_id: string
        }
        Update: {
          email?: boolean
          event_type?: string
          in_app?: boolean
          push?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          channels: string[]
          conditions: Json
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          relation: string | null
          role_id: string | null
          subscriber_kind: string
          user_configurable: boolean
          user_id: string | null
        }
        Insert: {
          channels?: string[]
          conditions?: Json
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          relation?: string | null
          role_id?: string | null
          subscriber_kind: string
          user_configurable?: boolean
          user_id?: string | null
        }
        Update: {
          channels?: string[]
          conditions?: Json
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          relation?: string | null
          role_id?: string | null
          subscriber_kind?: string
          user_configurable?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_subscriptions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string | null
          event_type: string
          id: string
          is_active: boolean
          language: string
          priority: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          language: string
          priority?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          language?: string
          priority?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_id: number | null
          event_type: string
          id: string
          link: string | null
          priority: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_id?: number | null
          event_type: string
          id?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_id?: number | null
          event_type?: string
          id?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklists: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          deal_id: string | null
          due_date: string | null
          employee_id: string | null
          id: string
          project_id: string | null
          status: string
          subject: string
          template_key: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          project_id?: string | null
          status?: string
          subject: string
          template_key: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          project_id?: string | null
          status?: string
          subject?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      onboarding_items: {
        Row: {
          assignee_user_id: string | null
          auto_key: string | null
          checklist_id: string
          done_at: string | null
          done_by: string | null
          due_date: string | null
          id: string
          is_done: boolean
          label: string
          notes: string | null
          required: boolean
          responsible: string | null
          section: string
          sort_order: number
          status: string
        }
        Insert: {
          assignee_user_id?: string | null
          auto_key?: string | null
          checklist_id: string
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          label: string
          notes?: string | null
          required?: boolean
          responsible?: string | null
          section: string
          sort_order?: number
          status?: string
        }
        Update: {
          assignee_user_id?: string | null
          auto_key?: string | null
          checklist_id?: string
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          label?: string
          notes?: string | null
          required?: boolean
          responsible?: string | null
          section?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_messages: {
        Row: {
          attempts: number
          body: string
          channel: string
          client_id: string | null
          connection_id: string | null
          conversation_message_id: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          delivered_at: string | null
          employee_id: string | null
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          next_attempt_at: string | null
          notification_delivery_id: string | null
          provider_message_id: string | null
          purpose: string
          read_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          to_phone: string
          variables: Json
        }
        Insert: {
          attempts?: number
          body: string
          channel: string
          client_id?: string | null
          connection_id?: string | null
          conversation_message_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          next_attempt_at?: string | null
          notification_delivery_id?: string | null
          provider_message_id?: string | null
          purpose?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          to_phone: string
          variables?: Json
        }
        Update: {
          attempts?: number
          body?: string
          channel?: string
          client_id?: string | null
          connection_id?: string | null
          conversation_message_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          next_attempt_at?: string | null
          notification_delivery_id?: string | null
          provider_message_id?: string | null
          purpose?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          to_phone?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_conversation_message_id_fkey"
            columns: ["conversation_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_requests: {
        Row: {
          actual_minutes: number | null
          amount: number | null
          approval_group_id: string | null
          approved_at: string | null
          approved_by: string | null
          approved_minutes: number | null
          compensation_status: string
          created_at: string
          currency: string | null
          day_type: string
          id: string
          minutes: number
          payslip_id: string | null
          rate_multiplier: number | null
          reason: string
          status: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          actual_minutes?: number | null
          amount?: number | null
          approval_group_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_minutes?: number | null
          compensation_status?: string
          created_at?: string
          currency?: string | null
          day_type?: string
          id?: string
          minutes: number
          payslip_id?: string | null
          rate_multiplier?: number | null
          reason: string
          status?: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          actual_minutes?: number | null
          amount?: number | null
          approval_group_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_minutes?: number | null
          compensation_status?: string
          created_at?: string
          currency?: string | null
          day_type?: string
          id?: string
          minutes?: number
          payslip_id?: string | null
          rate_multiplier?: number | null
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_payslip_fk"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          currency: string
          deal_id: string
          due_date: string | null
          id: string
          invoice_id: string | null
          label: string
          milestone_id: string | null
          percent: number
          project_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["schedule_status"]
          trigger: Database["public"]["Enums"]["schedule_trigger"]
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          currency: string
          deal_id: string
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          label: string
          milestone_id?: string | null
          percent: number
          project_id?: string | null
          sort_order: number
          status?: Database["public"]["Enums"]["schedule_status"]
          trigger?: Database["public"]["Enums"]["schedule_trigger"]
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          deal_id?: string
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          label?: string
          milestone_id?: string | null
          percent?: number
          project_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          trigger?: Database["public"]["Enums"]["schedule_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payment_schedules_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_milestone_fk"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deal_amount: number | null
          deal_id: string | null
          exchange_rate: number | null
          id: string
          idempotency_key: string | null
          invoice_amount: number | null
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          payment_number: string
          project_id: string | null
          reference: string | null
          refund_reason: string | null
          refunded_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          deal_amount?: number | null
          deal_id?: string | null
          exchange_rate?: number | null
          id?: string
          idempotency_key?: string | null
          invoice_amount?: number | null
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          payment_number?: string
          project_id?: string | null
          reference?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_amount?: number | null
          deal_id?: string | null
          exchange_rate?: number | null
          id?: string
          idempotency_key?: string | null
          invoice_amount?: number | null
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          payment_number?: string
          project_id?: string | null
          reference?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          calculated_at: string | null
          cancelled_reason: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          employee_count: number
          employee_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          pay_date: string | null
          period_end: string
          period_start: string
          run_number: string | null
          run_type: string
          status: string
          submitted_at: string | null
          totals: Json
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          calculated_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_count?: number
          employee_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          pay_date?: string | null
          period_end: string
          period_start: string
          run_number?: string | null
          run_type?: string
          status?: string
          submitted_at?: string | null
          totals?: Json
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          calculated_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_count?: number
          employee_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          pay_date?: string | null
          period_end?: string
          period_start?: string
          run_number?: string | null
          run_type?: string
          status?: string
          submitted_at?: string | null
          totals?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_lines: {
        Row: {
          amount: number
          category: string
          code: string
          id: string
          kind: string
          label: string
          payslip_id: string
          quantity: number | null
          rate: number | null
          sort_order: number
          source_id: string | null
          source_type: string | null
          taxable: boolean
        }
        Insert: {
          amount: number
          category: string
          code: string
          id?: string
          kind: string
          label: string
          payslip_id: string
          quantity?: number | null
          rate?: number | null
          sort_order?: number
          source_id?: string | null
          source_type?: string | null
          taxable?: boolean
        }
        Update: {
          amount?: number
          category?: string
          code?: string
          id?: string
          kind?: string
          label?: string
          payslip_id?: string
          quantity?: number | null
          rate?: number | null
          sort_order?: number
          source_id?: string | null
          source_type?: string | null
          taxable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payslip_lines_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          absent_days: number
          basic_salary: number
          created_at: string
          currency: string
          employee_id: string
          expense_id: string | null
          gross_pay: number
          id: string
          late_minutes: number
          net_pay: number
          notes: string | null
          overtime_minutes: number
          paid_at: string | null
          paid_days: number
          published_at: string | null
          run_id: string
          status: string
          taxable_pay: number
          total_deductions: number
          total_earnings: number
          unpaid_leave_days: number
          updated_at: string
          user_id: string | null
          warnings: string[]
          working_days: number
        }
        Insert: {
          absent_days?: number
          basic_salary?: number
          created_at?: string
          currency: string
          employee_id: string
          expense_id?: string | null
          gross_pay?: number
          id?: string
          late_minutes?: number
          net_pay?: number
          notes?: string | null
          overtime_minutes?: number
          paid_at?: string | null
          paid_days?: number
          published_at?: string | null
          run_id: string
          status?: string
          taxable_pay?: number
          total_deductions?: number
          total_earnings?: number
          unpaid_leave_days?: number
          updated_at?: string
          user_id?: string | null
          warnings?: string[]
          working_days?: number
        }
        Update: {
          absent_days?: number
          basic_salary?: number
          created_at?: string
          currency?: string
          employee_id?: string
          expense_id?: string | null
          gross_pay?: number
          id?: string
          late_minutes?: number
          net_pay?: number
          notes?: string | null
          overtime_minutes?: number
          paid_at?: string | null
          paid_days?: number
          published_at?: string | null
          run_id?: string
          status?: string
          taxable_pay?: number
          total_deductions?: number
          total_earnings?: number
          unpaid_leave_days?: number
          updated_at?: string
          user_id?: string | null
          warnings?: string[]
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_feedback: {
        Row: {
          comments: string | null
          created_at: string
          cycle_id: string | null
          from_user_id: string
          id: string
          improvements: string | null
          is_anonymous: boolean
          rating: number | null
          relationship: string
          requested_at: string
          requested_by: string | null
          review_id: string | null
          status: string
          strengths: string | null
          subject_user_id: string
          submitted_at: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          cycle_id?: string | null
          from_user_id: string
          id?: string
          improvements?: string | null
          is_anonymous?: boolean
          rating?: number | null
          relationship: string
          requested_at?: string
          requested_by?: string | null
          review_id?: string | null
          status?: string
          strengths?: string | null
          subject_user_id: string
          submitted_at?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          cycle_id?: string | null
          from_user_id?: string
          id?: string
          improvements?: string | null
          is_anonymous?: boolean
          rating?: number | null
          relationship?: string
          requested_at?: string
          requested_by?: string | null
          review_id?: string | null
          status?: string
          strengths?: string | null
          subject_user_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_feedback_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_feedback_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_goals: {
        Row: {
          created_at: string
          created_by: string | null
          current_value: number | null
          cycle_id: string | null
          description: string | null
          due_date: string | null
          id: string
          kpi_id: string | null
          metric: string | null
          progress: number
          start_date: string | null
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          cycle_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kpi_id?: string | null
          metric?: string | null
          progress?: number
          start_date?: string | null
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          cycle_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kpi_id?: string | null
          metric?: string | null
          progress?: number
          start_date?: string | null
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_goals_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_goals_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          acknowledged_at: string | null
          competencies: Json
          created_at: string
          cycle_id: string | null
          goals: string | null
          id: string
          improvements: string | null
          manager_rating: number | null
          overall_rating: number | null
          period_end: string
          period_start: string
          recommendation: string
          review_type: string
          reviewer_id: string | null
          self_assessment: string | null
          self_rating: number | null
          self_submitted_at: string | null
          status: string
          strengths: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          competencies?: Json
          created_at?: string
          cycle_id?: string | null
          goals?: string | null
          id?: string
          improvements?: string | null
          manager_rating?: number | null
          overall_rating?: number | null
          period_end: string
          period_start: string
          recommendation?: string
          review_type?: string
          reviewer_id?: string | null
          self_assessment?: string | null
          self_rating?: number | null
          self_submitted_at?: string | null
          status?: string
          strengths?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          competencies?: Json
          created_at?: string
          cycle_id?: string | null
          goals?: string | null
          id?: string
          improvements?: string | null
          manager_rating?: number | null
          overall_rating?: number | null
          period_end?: string
          period_start?: string
          recommendation?: string
          review_type?: string
          reviewer_id?: string | null
          self_assessment?: string | null
          self_rating?: number | null
          self_submitted_at?: string | null
          status?: string
          strengths?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          description: string | null
          id: string
          key: string
          module: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          description?: string | null
          id?: string
          key: string
          module: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          description?: string | null
          id?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          category: Database["public"]["Enums"]["stage_category"]
          created_at: string
          id: string
          is_active: boolean
          key: string
          name: string
          pipeline_id: string
          probability: number
          sort_order: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["stage_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          pipeline_id: string
          probability?: number
          sort_order?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["stage_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          pipeline_id?: string
          probability?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          entity: Database["public"]["Enums"]["pipeline_entity"]
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          entity: Database["public"]["Enums"]["pipeline_entity"]
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          entity?: Database["public"]["Enums"]["pipeline_entity"]
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      portfolio_companies: {
        Row: {
          cover_image: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          featured: boolean
          founded_year: number | null
          id: string
          industry_ar: string | null
          industry_en: string | null
          is_published: boolean
          logo: string | null
          markets: string[]
          name: string
          relationship_type: Database["public"]["Enums"]["portfolio_relationship_type"]
          short_description_ar: string | null
          short_description_en: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
          users_count: string | null
          website_url: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          featured?: boolean
          founded_year?: number | null
          id?: string
          industry_ar?: string | null
          industry_en?: string | null
          is_published?: boolean
          logo?: string | null
          markets?: string[]
          name: string
          relationship_type: Database["public"]["Enums"]["portfolio_relationship_type"]
          short_description_ar?: string | null
          short_description_en?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          users_count?: string | null
          website_url?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          featured?: boolean
          founded_year?: number | null
          id?: string
          industry_ar?: string | null
          industry_en?: string | null
          is_published?: boolean
          logo?: string | null
          markets?: string[]
          name?: string
          relationship_type?: Database["public"]["Enums"]["portfolio_relationship_type"]
          short_description_ar?: string | null
          short_description_en?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          users_count?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      portfolio_company_built_items: {
        Row: {
          company_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          company_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_company_built_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portfolio_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_company_metrics: {
        Row: {
          company_id: string
          id: string
          label: string
          sort_order: number
          value_display: string
          value_numeric: number | null
        }
        Insert: {
          company_id: string
          id?: string
          label: string
          sort_order?: number
          value_display: string
          value_numeric?: number | null
        }
        Update: {
          company_id?: string
          id?: string
          label?: string
          sort_order?: number
          value_display?: string
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_company_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portfolio_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_company_roles: {
        Row: {
          company_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          company_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portfolio_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_company_timeline: {
        Row: {
          company_id: string
          description: string | null
          id: string
          label: string
          sort_order: number
          year: number
        }
        Insert: {
          company_id: string
          description?: string | null
          id?: string
          label: string
          sort_order?: number
          year: number
        }
        Update: {
          company_id?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_company_timeline_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portfolio_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          client_name: string
          country_ar: string
          country_en: string
          created_at: string
          id: string
          image_path: string
          is_active: boolean
          project_name: string
          sort_order: number
        }
        Insert: {
          client_name: string
          country_ar: string
          country_en: string
          created_at?: string
          id?: string
          image_path: string
          is_active?: boolean
          project_name: string
          sort_order?: number
        }
        Update: {
          client_name?: string
          country_ar?: string
          country_en?: string
          created_at?: string
          id?: string
          image_path?: string
          is_active?: boolean
          project_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          currency: string | null
          default_price: number | null
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["product_kind"]
          name: string
          pricing_model: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          currency?: string | null
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          name: string
          pricing_model?: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          currency?: string | null
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          name?: string
          pricing_model?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      project_deployments: {
        Row: {
          client_visible: boolean
          created_at: string
          created_by: string | null
          deployed_at: string | null
          environment: string
          id: string
          notes: string | null
          project_id: string
          scheduled_at: string | null
          status: string
          updated_at: string
          url: string | null
          version: string | null
        }
        Insert: {
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          deployed_at?: string | null
          environment?: string
          id?: string
          notes?: string | null
          project_id: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          version?: string | null
        }
        Update: {
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          deployed_at?: string | null
          environment?: string
          id?: string
          notes?: string | null
          project_id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          allocation_percent: number | null
          project_id: string
          role_label: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          allocation_percent?: number | null
          project_id: string
          role_label?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          allocation_percent?: number | null
          project_id?: string
          role_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          milestones: Json
          name: string
          product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          milestones?: Json
          name: string
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          milestones?: Json
          name?: string
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          branch_id: string | null
          budget: number
          cancelled_reason: string | null
          client_id: string
          completed_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deadline: string | null
          deal_id: string | null
          health: Database["public"]["Enums"]["project_health"]
          health_reason: string | null
          id: string
          name: string
          pm_id: string | null
          previous_status: Database["public"]["Enums"]["project_status"] | null
          primary_contact_id: string | null
          progress: number
          project_number: string
          satisfaction_comment: string | null
          satisfaction_score: number | null
          scope: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          support_until: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          branch_id?: string | null
          budget?: number
          cancelled_reason?: string | null
          client_id: string
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          deadline?: string | null
          deal_id?: string | null
          health?: Database["public"]["Enums"]["project_health"]
          health_reason?: string | null
          id?: string
          name: string
          pm_id?: string | null
          previous_status?: Database["public"]["Enums"]["project_status"] | null
          primary_contact_id?: string | null
          progress?: number
          project_number?: string
          satisfaction_comment?: string | null
          satisfaction_score?: number | null
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          support_until?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          branch_id?: string | null
          budget?: number
          cancelled_reason?: string | null
          client_id?: string
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deadline?: string | null
          deal_id?: string | null
          health?: Database["public"]["Enums"]["project_health"]
          health_reason?: string | null
          id?: string
          name?: string
          pm_id?: string | null
          previous_status?: Database["public"]["Enums"]["project_status"] | null
          primary_contact_id?: string | null
          progress?: number
          project_number?: string
          satisfaction_comment?: string | null
          satisfaction_score?: number | null
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          support_until?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_access: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          id: string
          last_login_at: string | null
          proposal_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          last_login_at?: string | null
          proposal_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_access_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_projects: {
        Row: {
          case_study_id: string
          proposal_id: string
          sort_order: number
        }
        Insert: {
          case_study_id: string
          proposal_id: string
          sort_order?: number
        }
        Update: {
          case_study_id?: string
          proposal_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_projects_case_study_id_fkey"
            columns: ["case_study_id"]
            isOneToOne: false
            referencedRelation: "case_studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_projects_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          assumptions: string | null
          client_id: string
          content: Json
          created_at: string
          created_by: string | null
          currency: string | null
          deal_id: string | null
          expired_at: string | null
          first_viewed_at: string | null
          id: string
          is_archived: boolean
          last_viewed_at: string | null
          owner_id: string | null
          payment_schedule: Json
          published_at: string | null
          published_content: Json | null
          published_projects_snapshot: Json
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          slug: string
          status: Database["public"]["Enums"]["proposal_status"]
          subtitle: string | null
          terms: string | null
          title: string
          total_amount: number | null
          updated_at: string
          valid_until: string | null
          version: number
          view_count: number
        }
        Insert: {
          accepted_at?: string | null
          assumptions?: string | null
          client_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deal_id?: string | null
          expired_at?: string | null
          first_viewed_at?: string | null
          id?: string
          is_archived?: boolean
          last_viewed_at?: string | null
          owner_id?: string | null
          payment_schedule?: Json
          published_at?: string | null
          published_content?: Json | null
          published_projects_snapshot?: Json
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["proposal_status"]
          subtitle?: string | null
          terms?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          version?: number
          view_count?: number
        }
        Update: {
          accepted_at?: string | null
          assumptions?: string | null
          client_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deal_id?: string | null
          expired_at?: string | null
          first_viewed_at?: string | null
          id?: string
          is_archived?: boolean
          last_viewed_at?: string | null
          owner_id?: string | null
          payment_schedule?: Json
          published_at?: string | null
          published_content?: Json | null
          published_projects_snapshot?: Json
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          subtitle?: string | null
          terms?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          version?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      review_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_type: string
          id: string
          name: string
          peer_feedback: boolean
          period_end: string
          period_start: string
          self_assessment: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_type?: string
          id?: string
          name: string
          peer_feedback?: boolean
          period_end: string
          period_start: string
          self_assessment?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_type?: string
          id?: string
          name?: string
          peer_feedback?: boolean
          period_end?: string
          period_start?: string
          self_assessment?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_app_requirements: {
        Row: {
          app_id: string
          default_access_level: string | null
          is_required: boolean
          role_id: string
        }
        Insert: {
          app_id: string
          default_access_level?: string | null
          is_required?: boolean
          role_id: string
        }
        Update: {
          app_id?: string
          default_access_level?: string | null
          is_required?: boolean
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_app_requirements_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "external_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_app_requirements_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
          scope: Database["public"]["Enums"]["permission_scope"]
        }
        Insert: {
          permission_id: string
          role_id: string
          scope?: Database["public"]["Enums"]["permission_scope"]
        }
        Update: {
          permission_id?: string
          role_id?: string
          scope?: Database["public"]["Enums"]["permission_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_client_role: boolean
          is_system: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_client_role?: boolean
          is_system?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_client_role?: boolean
          is_system?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      salary_components: {
        Row: {
          calc_type: string
          category: string
          created_at: string
          default_value: number | null
          id: string
          is_active: boolean
          key: string
          kind: string
          name: string
          sort_order: number
          taxable: boolean
        }
        Insert: {
          calc_type?: string
          category: string
          created_at?: string
          default_value?: number | null
          id?: string
          is_active?: boolean
          key: string
          kind: string
          name: string
          sort_order?: number
          taxable?: boolean
        }
        Update: {
          calc_type?: string
          category?: string
          created_at?: string
          default_value?: number | null
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          name?: string
          sort_order?: number
          taxable?: boolean
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          columns: Json
          created_at: string
          filters: Json
          id: string
          is_shared: boolean
          module: string
          name: string
          sort: Json
          user_id: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          module: string
          name: string
          sort?: Json
          user_id: string
        }
        Update: {
          columns?: Json
          created_at?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          module?: string
          name?: string
          sort?: Json
          user_id?: string
        }
        Relationships: []
      }
      schedule_assignments: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string | null
          id: string
          notes: string | null
          schedule_id: string
          scope: string
          team_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          schedule_id: string
          scope: string
          team_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          schedule_id?: string
          scope?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          notes: string | null
          schedule_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          schedule_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          schedule_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_events: {
        Row: {
          actor_user_id: string | null
          detail: string | null
          event: string
          id: number
          occurred_at: string
          request_id: string
          source: string
        }
        Insert: {
          actor_user_id?: string | null
          detail?: string | null
          event: string
          id?: number
          occurred_at?: string
          request_id: string
          source: string
        }
        Update: {
          actor_user_id?: string | null
          detail?: string | null
          event?: string
          id?: number
          occurred_at?: string
          request_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          created_at: string
          created_by: string | null
          document_id: string
          entity_id: string
          entity_type: string
          expires_at: string | null
          external_id: string | null
          id: string
          last_checked_at: string | null
          last_error: string | null
          message: string | null
          number: string
          provider: string
          sent_at: string | null
          signed_file_id: string | null
          signing_order: string
          status: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          entity_id: string
          entity_type: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          message?: string | null
          number?: string
          provider: string
          sent_at?: string | null
          signed_file_id?: string | null
          signing_order?: string
          status?: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          message?: string | null
          number?: string
          provider?: string
          sent_at?: string | null
          signed_file_id?: string | null
          signing_order?: string
          status?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_signed_file_id_fkey"
            columns: ["signed_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_signers: {
        Row: {
          contact_id: string | null
          declined_reason: string | null
          delivered_at: string | null
          email: string
          id: string
          name: string
          recipient_id: number
          request_id: string
          role: string
          routing_order: number
          signed_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          declined_reason?: string | null
          delivered_at?: string | null
          email: string
          id?: string
          name: string
          recipient_id: number
          request_id: string
          role?: string
          routing_order?: number
          signed_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          declined_reason?: string | null
          delivered_at?: string | null
          email?: string
          id?: string
          name?: string
          recipient_id?: number
          request_id?: string
          role?: string
          routing_order?: number
          signed_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_signers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_signers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sla_policies: {
        Row: {
          first_response_minutes: number
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          resolution_minutes: number
        }
        Insert: {
          first_response_minutes: number
          id?: string
          priority: Database["public"]["Enums"]["priority_level"]
          resolution_minutes: number
        }
        Update: {
          first_response_minutes?: number
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          resolution_minutes?: number
        }
        Relationships: []
      }
      social_account_metrics: {
        Row: {
          account_id: string
          day: string
          fetched_at: string
          metric: string
          source: string
          value: number
        }
        Insert: {
          account_id: string
          day: string
          fetched_at?: string
          metric: string
          source: string
          value: number
        }
        Update: {
          account_id?: string
          day?: string
          fetched_at?: string
          metric?: string
          source?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_account_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          connected_at: string
          connected_by: string | null
          connection_id: string | null
          created_at: string
          external_id: string | null
          handle: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          mode: string
          name: string
          platform: string
          profile_url: string | null
          scopes: string[]
          status: string
          token_enc: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          connected_at?: string
          connected_by?: string | null
          connection_id?: string | null
          created_at?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          mode?: string
          name: string
          platform: string
          profile_url?: string | null
          scopes?: string[]
          status?: string
          token_enc?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          connected_at?: string
          connected_by?: string | null
          connection_id?: string | null
          created_at?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          mode?: string
          name?: string
          platform?: string
          profile_url?: string | null
          scopes?: string[]
          status?: string
          token_enc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_metrics: {
        Row: {
          fetched_at: string
          metric: string
          recorded_by: string | null
          source: string
          target_id: string
          value: number
        }
        Insert: {
          fetched_at?: string
          metric: string
          recorded_by?: string | null
          source: string
          target_id: string
          value: number
        }
        Update: {
          fetched_at?: string
          metric?: string
          recorded_by?: string | null
          source?: string
          target_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_post_metrics_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "social_post_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_targets: {
        Row: {
          account_id: string
          attempts: number
          created_at: string
          error: string | null
          external_post_id: string | null
          id: string
          media_override: Json | null
          metrics_synced_at: string | null
          next_attempt_at: string | null
          post_id: string
          post_url: string | null
          published_at: string | null
          status: string
          text_override: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          attempts?: number
          created_at?: string
          error?: string | null
          external_post_id?: string | null
          id?: string
          media_override?: Json | null
          metrics_synced_at?: string | null
          next_attempt_at?: string | null
          post_id: string
          post_url?: string | null
          published_at?: string | null
          status?: string
          text_override?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          attempts?: number
          created_at?: string
          error?: string | null
          external_post_id?: string | null
          id?: string
          media_override?: Json | null
          metrics_synced_at?: string | null
          next_attempt_at?: string | null
          post_id?: string
          post_url?: string | null
          published_at?: string | null
          status?: string
          text_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_targets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_text: string
          branch_id: string | null
          campaign: string | null
          content_id: string | null
          created_at: string
          created_by: string | null
          hashtags: string[]
          id: string
          link_url: string | null
          media: Json
          number: string
          owner_id: string | null
          published_at: string | null
          review_note: string | null
          reviewer_id: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_text?: string
          branch_id?: string | null
          campaign?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          link_url?: string | null
          media?: Json
          number?: string
          owner_id?: string | null
          published_at?: string | null
          review_note?: string | null
          reviewer_id?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_text?: string
          branch_id?: string | null
          campaign?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          link_url?: string | null
          media?: Json
          number?: string
          owner_id?: string | null
          published_at?: string | null
          review_note?: string | null
          reviewer_id?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_content_fk"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_steps: {
        Row: {
          article_id: string
          description: string | null
          id: string
          kind: string
          sort_order: number
          title: string
        }
        Insert: {
          article_id: string
          description?: string | null
          id?: string
          kind?: string
          sort_order?: number
          title: string
        }
        Update: {
          article_id?: string
          description?: string | null
          id?: string
          kind?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_steps_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          from_status: string | null
          id: number
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: never
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: never
          reason?: string | null
          to_status?: string
        }
        Relationships: []
      }
      support_customers: {
        Row: {
          client_id: string | null
          company: string | null
          contact_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_channel: string | null
          id: string
          last_seen_at: string | null
          merged_into: string | null
          name: string
          normalized_email: string | null
          normalized_phone: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          priority: string
          source: string | null
          tags: string[]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          client_id?: string | null
          company?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_channel?: string | null
          id?: string
          last_seen_at?: string | null
          merged_into?: string | null
          name: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          priority?: string
          source?: string | null
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          client_id?: string | null
          company?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_channel?: string | null
          id?: string
          last_seen_at?: string | null
          merged_into?: string | null
          name?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          priority?: string
          source?: string | null
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_customers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_customers_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_plans: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          includes: string | null
          monthly_hours: number | null
          name: string
          notes: string | null
          project_id: string | null
          response_hours: number | null
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          includes?: string | null
          monthly_hours?: number | null
          name: string
          notes?: string | null
          project_id?: string | null
          response_hours?: number | null
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          includes?: string | null
          monthly_hours?: number | null
          name?: string
          notes?: string | null
          project_id?: string | null
          response_hours?: number | null
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      support_team_members: {
        Row: {
          is_available: boolean
          last_assigned_at: string | null
          max_open: number
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          is_available?: boolean
          last_assigned_at?: string | null
          max_open?: number
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          is_available?: boolean
          last_assigned_at?: string | null
          max_open?: number
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      support_teams: {
        Row: {
          assignment: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        Insert: {
          assignment?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
        }
        Update: {
          assignment?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      support_widgets: {
        Row: {
          ai_agent_id: string | null
          allowed_domains: string[]
          bottom_offset: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          language: string
          name: string
          offline_message: string
          position: string
          primary_color: string
          public_key: string
          require_email: boolean
          team_id: string | null
          title: string
          updated_at: string
          welcome_message: string
          working_hours: Json
        }
        Insert: {
          ai_agent_id?: string | null
          allowed_domains?: string[]
          bottom_offset?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name: string
          offline_message?: string
          position?: string
          primary_color?: string
          public_key?: string
          require_email?: boolean
          team_id?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string
          working_hours?: Json
        }
        Update: {
          ai_agent_id?: string | null
          allowed_domains?: string[]
          bottom_offset?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          offline_message?: string
          position?: string
          primary_color?: string
          public_key?: string
          require_email?: boolean
          team_id?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "support_widgets_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_widgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_widgets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          label: string
          sort_order: number
          task_id: string
        }
        Insert: {
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label: string
          sort_order?: number
          task_id: string
        }
        Update: {
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label?: string
          sort_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          depends_on_task_id: string
          task_id: string
        }
        Insert: {
          depends_on_task_id: string
          task_id: string
        }
        Update: {
          depends_on_task_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number
          archived_at: string | null
          assigned_to: string | null
          client_id: string | null
          client_visible: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          is_required: boolean
          lead_id: string | null
          milestone_id: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          sort_order: number
          source_key: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_minutes?: number
          archived_at?: string | null
          assigned_to?: string | null
          client_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean
          lead_id?: string | null
          milestone_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          sort_order?: number
          source_key?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_minutes?: number
          archived_at?: string | null
          assigned_to?: string | null
          client_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean
          lead_id?: string | null
          milestone_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          sort_order?: number
          source_key?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          archived_at: string | null
          created_at: string
          department_id: string | null
          id: string
          lead_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          lead_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          lead_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          category: string
          client_id: string | null
          closed_at: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by_contact_id: string | null
          created_by_user_id: string | null
          description: string
          first_responded_at: string | null
          first_response_due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          sla_breached_at: string | null
          source: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          support_customer_id: string | null
          team_id: string | null
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          category?: string
          client_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by_contact_id?: string | null
          created_by_user_id?: string | null
          description: string
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          sla_breached_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          support_customer_id?: string | null
          team_id?: string | null
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          category?: string
          client_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by_contact_id?: string | null
          created_by_user_id?: string | null
          description?: string
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          sla_breached_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          support_customer_id?: string | null
          team_id?: string | null
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_contact_id_fkey"
            columns: ["created_by_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_support_customer_id_fkey"
            columns: ["support_customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          client_id: string | null
          cost_amount: number | null
          cost_currency: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          project_id: string | null
          rejection_reason: string | null
          source: string
          started_at: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          client_id?: string | null
          cost_amount?: number | null
          cost_currency?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          project_id?: string | null
          rejection_reason?: string | null
          source?: string
          started_at: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          client_id?: string | null
          cost_amount?: number | null
          cost_currency?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          project_id?: string | null
          rejection_reason?: string | null
          source?: string
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_cost_currency_fkey"
            columns: ["cost_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_access: {
        Row: {
          branch_id: string
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          employee_id: string | null
          id: string
          invited_by: string | null
          last_sent_at: string
          revoked_at: string | null
          revoked_by: string | null
          sent_count: number
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          employee_id?: string | null
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          sent_count?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          employee_id?: string | null
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          sent_count?: number
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          effect: string
          permission_id: string
          reason: string | null
          scope: Database["public"]["Enums"]["permission_scope"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effect: string
          permission_id: string
          reason?: string | null
          scope?: Database["public"]["Enums"]["permission_scope"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effect?: string
          permission_id?: string
          reason?: string | null
          scope?: Database["public"]["Enums"]["permission_scope"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          date_format: string | null
          language: string | null
          theme: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          date_format?: string | null
          language?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          date_format?: string | null
          language?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          archived_at: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          services: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          services?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          services?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          connection_id: string | null
          error: string | null
          event_id: string
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          signature_ok: boolean
          status: string
        }
        Insert: {
          attempts?: number
          connection_id?: string | null
          error?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_ok: boolean
          status?: string
        }
        Update: {
          attempts?: number
          connection_id?: string | null
          error?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_ok?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_widget_clicks: {
        Row: {
          clicks: number
          day: string
          widget_id: string
        }
        Insert: {
          clicks?: number
          day: string
          widget_id: string
        }
        Update: {
          clicks?: number
          day?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_widget_clicks_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_widgets: {
        Row: {
          allowed_domains: string[]
          bottom_offset: number
          created_at: string
          created_by: string | null
          greeting: string
          id: string
          is_active: boolean
          label: string
          name: string
          phone: string
          position: string
          public_key: string
          updated_at: string
        }
        Insert: {
          allowed_domains?: string[]
          bottom_offset?: number
          created_at?: string
          created_by?: string | null
          greeting?: string
          id?: string
          is_active?: boolean
          label?: string
          name: string
          phone: string
          position?: string
          public_key?: string
          updated_at?: string
        }
        Update: {
          allowed_domains?: string[]
          bottom_offset?: number
          created_at?: string
          created_by?: string | null
          greeting?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          phone?: string
          position?: string
          public_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      widget_sessions: {
        Row: {
          conversation_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          last_seen_at: string
          origin: string | null
          page_url: string | null
          token_hash: string
          user_agent: string | null
          widget_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_seen_at?: string
          origin?: string | null
          page_url?: string | null
          token_hash: string
          user_agent?: string | null
          widget_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_seen_at?: string
          origin?: string | null
          page_url?: string | null
          token_hash?: string
          user_agent?: string | null
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "support_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_sessions_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "support_widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedule_days: {
        Row: {
          break_minutes: number
          end_time: string
          is_working: boolean
          schedule_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          break_minutes?: number
          end_time: string
          is_working?: boolean
          schedule_id: string
          start_time: string
          weekday: number
        }
        Update: {
          break_minutes?: number
          end_time?: string
          is_working?: boolean
          schedule_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_schedule_days_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          break_minutes: number
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          grace_minutes: number
          half_day_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          overtime_after_minutes: number
          required_minutes: number | null
          schedule_type: string
          start_time: string
          timezone: string
          updated_at: string
          work_days: number[]
        }
        Insert: {
          break_minutes?: number
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          grace_minutes?: number
          half_day_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          overtime_after_minutes?: number
          required_minutes?: number | null
          schedule_type?: string
          start_time: string
          timezone?: string
          updated_at?: string
          work_days: number[]
        }
        Update: {
          break_minutes?: number
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          grace_minutes?: number
          half_day_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          overtime_after_minutes?: number
          required_minutes?: number | null
          schedule_type?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          work_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bos_apply_attendance_correction: {
        Args: { p_comment?: string; p_correction: string; p_reviewer: string }
        Returns: undefined
      }
      bos_apply_change_request: {
        Args: { p_actor: string; p_cr: string }
        Returns: undefined
      }
      bos_apply_leave: { Args: { p_leave: string }; Returns: undefined }
      bos_apply_payment_completed: {
        Args: { p_actor: string; p_payment_id: string }
        Returns: undefined
      }
      bos_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_actor_type?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new?: Json
          p_old?: Json
          p_reason?: string
        }
        Returns: undefined
      }
      bos_base_currency: { Args: never; Returns: string }
      bos_branch_ok: { Args: { b: string; f: Json }; Returns: boolean }
      bos_branch_ok_deal: {
        Args: { f: Json; p_deal: string }
        Returns: boolean
      }
      bos_check_sla_breaches: { Args: never; Returns: number }
      bos_clock_in: {
        Args: { p_client_tz?: string; p_source?: string; p_user: string }
        Returns: string
      }
      bos_clock_out: {
        Args: { p_source?: string; p_user: string }
        Returns: string
      }
      bos_complete_onboarding_item: {
        Args: { p_actor: string; p_auto_key: string; p_checklist: string }
        Returns: boolean
      }
      bos_create_invoice_from_schedule: {
        Args: { p_actor: string; p_schedule_id: string }
        Returns: string
      }
      bos_day_off_reason: {
        Args: { p_date: string; p_employee: string }
        Returns: string
      }
      bos_detect_open_sessions: { Args: never; Returns: number }
      bos_emit: {
        Args: {
          p_actor: string
          p_actor_type?: string
          p_dedupe_key?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_links?: Json
          p_payload?: Json
          p_summary: string
          p_visibility?: string
        }
        Returns: number
      }
      bos_employee_day_info: {
        Args: { p_date: string; p_user: string }
        Returns: Json
      }
      bos_employee_salary_on: {
        Args: { p_date: string; p_employee: string }
        Returns: {
          approval_status: string
          basic_salary: number
          change_type: string
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          effective_from: string
          employee_id: string
          id: string
          pay_frequency: string
          reason: string | null
          review_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employee_compensation"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bos_employee_schedule: {
        Args: { p_user: string }
        Returns: {
          break_minutes: number
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          grace_minutes: number
          half_day_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          overtime_after_minutes: number
          required_minutes: number | null
          schedule_type: string
          start_time: string
          timezone: string
          updated_at: string
          work_days: number[]
        }
        SetofOptions: {
          from: "*"
          to: "work_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bos_employee_schedule_on: {
        Args: { p_date: string; p_user: string }
        Returns: {
          break_minutes: number
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          grace_minutes: number
          half_day_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          overtime_after_minutes: number
          required_minutes: number | null
          schedule_type: string
          start_time: string
          timezone: string
          updated_at: string
          work_days: number[]
        }
        SetofOptions: {
          from: "*"
          to: "work_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bos_employee_work_days: {
        Args: { p_employee: string; p_from: string; p_to: string }
        Returns: number
      }
      bos_end_break: { Args: { p_user: string }; Returns: undefined }
      bos_ensure_client_email_unique: { Args: never; Returns: undefined }
      bos_evaluate_commissions: {
        Args: { p_actor?: string; p_deal_id: string }
        Returns: undefined
      }
      bos_filter_from: { Args: { f: Json }; Returns: string }
      bos_filter_to: { Args: { f: Json }; Returns: string }
      bos_filter_users: { Args: { f: Json }; Returns: string[] }
      bos_find_auth_user_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      bos_fx_rate: {
        Args: { p_date?: string; p_from: string; p_to: string }
        Returns: number
      }
      bos_generate_access_checklist: {
        Args: { p_actor: string; p_employee: string }
        Returns: number
      }
      bos_head_office: { Args: never; Returns: string }
      bos_is_work_day: {
        Args: { p_date: string; p_user: string }
        Returns: boolean
      }
      bos_kpi_actual: {
        Args: {
          p_end: string
          p_source: string
          p_start: string
          p_user: string
        }
        Returns: number
      }
      bos_leave_duration: {
        Args: {
          p_end: string
          p_half: boolean
          p_start: string
          p_user: string
        }
        Returns: number
      }
      bos_mark_absences: { Args: { p_date: string }; Returns: number }
      bos_mark_overdue_invoices: { Args: never; Returns: number }
      bos_mark_overdue_work: { Args: { p_today?: string }; Returns: number }
      bos_merge_accounts: {
        Args: { p_actor: string; p_source: string; p_target: string }
        Returns: Json
      }
      bos_next_number: { Args: { seq_key: string }; Returns: string }
      bos_norm: { Args: { p: string }; Returns: string }
      bos_pick_pm: { Args: never; Returns: string }
      bos_pick_user_for_role: {
        Args: { p_kind?: string; p_role_key: string }
        Returns: string
      }
      bos_process_deal_won: {
        Args: { p_actor: string; p_deal_id: string }
        Returns: string
      }
      bos_project_completion_blockers: {
        Args: { p_project: string }
        Returns: string[]
      }
      bos_project_financials: { Args: { p_project: string }; Returns: Json }
      bos_rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      bos_recalc_attendance_day: {
        Args: { p_record: string }
        Returns: undefined
      }
      bos_recalc_deal_payments: {
        Args: { p_actor?: string; p_deal_id: string }
        Returns: undefined
      }
      bos_recalc_invoice: {
        Args: { p_actor?: string; p_invoice_id: string }
        Returns: undefined
      }
      bos_recompute_all_project_health: { Args: never; Returns: number }
      bos_recompute_project_health: {
        Args: { p_project: string }
        Returns: Database["public"]["Enums"]["project_health"]
      }
      bos_recompute_project_progress: {
        Args: { p_project: string }
        Returns: undefined
      }
      bos_record_payment: {
        Args: { p: Json; p_actor: string }
        Returns: string
      }
      bos_reference_count: {
        Args: { p_id: string; p_table: string }
        Returns: number
      }
      bos_refund_payment: {
        Args: {
          p_actor: string
          p_amount: number
          p_payment_id: string
          p_reason: string
        }
        Returns: undefined
      }
      bos_report_bd: { Args: { f: Json }; Returns: Json }
      bos_report_clients: { Args: { f: Json }; Returns: Json }
      bos_report_countries: { Args: { f: Json }; Returns: Json }
      bos_report_products: { Args: { f: Json }; Returns: Json }
      bos_report_projects: { Args: { f: Json }; Returns: Json }
      bos_report_revenue: { Args: { f: Json }; Returns: Json }
      bos_report_sales: { Args: { f: Json }; Returns: Json }
      bos_report_team: { Args: { f: Json }; Returns: Json }
      bos_resolve_schedule_id: {
        Args: { p_date: string; p_employee: string }
        Returns: string
      }
      bos_round_money: {
        Args: { p_amount: number; p_currency: string }
        Returns: number
      }
      bos_schedule_day: {
        Args: { p_date: string; p_schedule: string }
        Returns: Database["public"]["CompositeTypes"]["bos_schedule_day_t"]
        SetofOptions: {
          from: "*"
          to: "bos_schedule_day_t"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bos_search: {
        Args: { p_limit?: number; p_q: string; p_types?: string[] }
        Returns: {
          client_id: string
          entity_type: string
          id: string
          owner_id: string
          project_id: string
          rank: number
          subtitle: string
          title: string
        }[]
      }
      bos_set_payment_status: {
        Args: {
          p_actor: string
          p_payment_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["payment_status"]
        }
        Returns: undefined
      }
      bos_start_break: { Args: { p_user: string }; Returns: string }
      bos_start_onboarding: {
        Args: {
          p_client: string
          p_deal: string
          p_due?: string
          p_employee: string
          p_project: string
          p_subject: string
          p_template_key: string
        }
        Returns: string
      }
      bos_status: {
        Args: {
          p_by: string
          p_entity_id: string
          p_entity_type: string
          p_from: string
          p_reason?: string
          p_to: string
        }
        Returns: undefined
      }
      bos_sync_hourly_cost: { Args: { p_employee: string }; Returns: undefined }
      bos_to_base: {
        Args: { p_amount: number; p_currency: string; p_date?: string }
        Returns: number
      }
      bos_update_commission_eligibility: {
        Args: { p_actor?: string; p_deal_id: string }
        Returns: undefined
      }
      bos_user_branch: { Args: { p_user: string }; Returns: string }
      bos_whatsapp_click: { Args: { p_widget: string }; Returns: undefined }
      has_proposal_access: {
        Args: { target_proposal_id: string }
        Returns: boolean
      }
      portal_client_id: { Args: never; Returns: string }
      portal_owns_entity: {
        Args: { p_id: string; p_type: string }
        Returns: boolean
      }
    }
    Enums: {
      access_status:
        | "not_started"
        | "requested"
        | "pending"
        | "provisioned"
        | "active"
        | "rejected"
        | "revoked"
        | "expired"
      account_status: "prospect" | "active" | "inactive" | "churned"
      activity_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "overdue"
      activity_type:
        | "call"
        | "email"
        | "whatsapp"
        | "linkedin"
        | "meeting"
        | "follow_up"
        | "task"
        | "note"
        | "internal"
        | "client_communication"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "superseded"
        | "changes_requested"
      approval_type:
        | "proposal"
        | "contract"
        | "design"
        | "scope"
        | "change_request"
        | "invoice"
        | "final_delivery"
        | "leave"
        | "expense"
        | "access_request"
        | "attendance_correction"
        | "overtime"
        | "milestone"
        | "payroll"
        | "loan"
        | "bonus"
        | "hr_request"
        | "job_offer"
        | "salary_adjustment"
      attendance_status:
        | "present"
        | "late"
        | "absent"
        | "half_day"
        | "leave"
        | "holiday"
        | "overtime"
        | "remote"
        | "on_break"
        | "day_off"
      change_request_status:
        | "requested"
        | "assessment"
        | "proposal"
        | "client_approval"
        | "approved"
        | "added_to_project"
        | "rejected"
      channel_kind: "direct" | "team" | "project" | "entity"
      commission_status:
        | "pending"
        | "eligible"
        | "approved"
        | "paid"
        | "cancelled"
      commission_trigger:
        | "deal_won"
        | "contract_signed"
        | "payment_collected"
        | "full_payment"
        | "milestone_payment"
      contract_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partially_signed"
        | "signed"
        | "expired"
        | "cancelled"
      correction_status: "pending" | "approved" | "rejected"
      cost_type:
        | "employee"
        | "freelancer"
        | "vendor"
        | "infrastructure"
        | "third_party"
        | "other"
      crm_stage:
        | "lead"
        | "qualified"
        | "call_booked"
        | "call_completed"
        | "proposal_requested"
        | "proposal_sent"
        | "proposal_viewed"
        | "proposal_accepted"
        | "proposal_rejected"
        | "contract"
        | "invoice"
        | "project"
      deal_payment_status: "unpaid" | "partially_paid" | "paid"
      device_security_status:
        | "compliant"
        | "warning"
        | "non_compliant"
        | "unknown"
      device_status:
        | "purchased"
        | "in_stock"
        | "assigned"
        | "in_repair"
        | "retired"
        | "lost"
      device_type:
        | "laptop"
        | "desktop"
        | "monitor"
        | "mobile"
        | "tablet"
        | "headset"
        | "other"
        | "office_equipment"
        | "software_license"
        | "loanable"
        | "spare_part"
      employee_lifecycle_status:
        | "candidate"
        | "hired"
        | "pending_onboarding"
        | "onboarding"
        | "active"
        | "on_leave"
        | "suspended"
        | "offboarding"
        | "terminated"
        | "archived"
      employment_type:
        | "full_time"
        | "part_time"
        | "contractor"
        | "intern"
        | "freelancer"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      kb_kind:
        | "article"
        | "sop"
        | "playbook"
        | "documentation"
        | "policy"
        | "onboarding_guide"
      kpi_period: "weekly" | "monthly" | "quarterly" | "yearly"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      meeting_status: "scheduled" | "completed" | "cancelled" | "no_show"
      mfa_status:
        | "required"
        | "not_configured"
        | "pending"
        | "enabled"
        | "disabled"
        | "recovery_required"
      milestone_status: "not_started" | "in_progress" | "blocked" | "completed"
      payment_method:
        | "bank_transfer"
        | "card"
        | "cash"
        | "paypal"
        | "stripe"
        | "wise"
        | "instapay"
        | "vodafone_cash"
        | "other"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      permission_action:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "approve"
        | "export"
        | "assign"
        | "manage"
        | "view_sensitive"
      permission_scope: "own" | "assigned" | "team" | "all"
      pipeline_entity: "lead" | "deal"
      playbook_section:
        | "outreach_templates"
        | "discovery_questions"
        | "objection_handling"
        | "pricing_rules"
        | "qualification_framework"
        | "follow_up_sequences"
        | "proposal_templates"
        | "closing_process"
      portfolio_relationship_type:
        | "owned"
        | "co_founded"
        | "equity"
        | "revenue_share"
        | "acquired"
      priority_level: "low" | "medium" | "high" | "urgent"
      product_kind: "product" | "service"
      project_health: "healthy" | "at_risk" | "delayed"
      project_status:
        | "planning"
        | "design"
        | "development"
        | "qa"
        | "client_review"
        | "launch"
        | "completed"
        | "on_hold"
        | "cancelled"
      proposal_status:
        | "draft"
        | "ready"
        | "published"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      schedule_status: "scheduled" | "invoiced" | "paid" | "cancelled"
      schedule_trigger:
        | "on_signing"
        | "on_date"
        | "on_milestone"
        | "on_completion"
      stage_category: "open" | "won" | "lost"
      task_status:
        | "pending"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
        | "overdue"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_for_client"
        | "resolved"
        | "closed"
    }
    CompositeTypes: {
      bos_schedule_day_t: {
        is_working: boolean | null
        start_time: string | null
        end_time: string | null
        break_minutes: number | null
        flexible: boolean | null
        required_minutes: number | null
        overnight: boolean | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_status: [
        "not_started",
        "requested",
        "pending",
        "provisioned",
        "active",
        "rejected",
        "revoked",
        "expired",
      ],
      account_status: ["prospect", "active", "inactive", "churned"],
      activity_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        "overdue",
      ],
      activity_type: [
        "call",
        "email",
        "whatsapp",
        "linkedin",
        "meeting",
        "follow_up",
        "task",
        "note",
        "internal",
        "client_communication",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "superseded",
        "changes_requested",
      ],
      approval_type: [
        "proposal",
        "contract",
        "design",
        "scope",
        "change_request",
        "invoice",
        "final_delivery",
        "leave",
        "expense",
        "access_request",
        "attendance_correction",
        "overtime",
        "milestone",
        "payroll",
        "loan",
        "bonus",
        "hr_request",
        "job_offer",
        "salary_adjustment",
      ],
      attendance_status: [
        "present",
        "late",
        "absent",
        "half_day",
        "leave",
        "holiday",
        "overtime",
        "remote",
        "on_break",
        "day_off",
      ],
      change_request_status: [
        "requested",
        "assessment",
        "proposal",
        "client_approval",
        "approved",
        "added_to_project",
        "rejected",
      ],
      channel_kind: ["direct", "team", "project", "entity"],
      commission_status: [
        "pending",
        "eligible",
        "approved",
        "paid",
        "cancelled",
      ],
      commission_trigger: [
        "deal_won",
        "contract_signed",
        "payment_collected",
        "full_payment",
        "milestone_payment",
      ],
      contract_status: [
        "draft",
        "sent",
        "viewed",
        "partially_signed",
        "signed",
        "expired",
        "cancelled",
      ],
      correction_status: ["pending", "approved", "rejected"],
      cost_type: [
        "employee",
        "freelancer",
        "vendor",
        "infrastructure",
        "third_party",
        "other",
      ],
      crm_stage: [
        "lead",
        "qualified",
        "call_booked",
        "call_completed",
        "proposal_requested",
        "proposal_sent",
        "proposal_viewed",
        "proposal_accepted",
        "proposal_rejected",
        "contract",
        "invoice",
        "project",
      ],
      deal_payment_status: ["unpaid", "partially_paid", "paid"],
      device_security_status: [
        "compliant",
        "warning",
        "non_compliant",
        "unknown",
      ],
      device_status: [
        "purchased",
        "in_stock",
        "assigned",
        "in_repair",
        "retired",
        "lost",
      ],
      device_type: [
        "laptop",
        "desktop",
        "monitor",
        "mobile",
        "tablet",
        "headset",
        "other",
        "office_equipment",
        "software_license",
        "loanable",
        "spare_part",
      ],
      employee_lifecycle_status: [
        "candidate",
        "hired",
        "pending_onboarding",
        "onboarding",
        "active",
        "on_leave",
        "suspended",
        "offboarding",
        "terminated",
        "archived",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contractor",
        "intern",
        "freelancer",
      ],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      kb_kind: [
        "article",
        "sop",
        "playbook",
        "documentation",
        "policy",
        "onboarding_guide",
      ],
      kpi_period: ["weekly", "monthly", "quarterly", "yearly"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      meeting_status: ["scheduled", "completed", "cancelled", "no_show"],
      mfa_status: [
        "required",
        "not_configured",
        "pending",
        "enabled",
        "disabled",
        "recovery_required",
      ],
      milestone_status: ["not_started", "in_progress", "blocked", "completed"],
      payment_method: [
        "bank_transfer",
        "card",
        "cash",
        "paypal",
        "stripe",
        "wise",
        "instapay",
        "vodafone_cash",
        "other",
      ],
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      permission_action: [
        "create",
        "read",
        "update",
        "delete",
        "approve",
        "export",
        "assign",
        "manage",
        "view_sensitive",
      ],
      permission_scope: ["own", "assigned", "team", "all"],
      pipeline_entity: ["lead", "deal"],
      playbook_section: [
        "outreach_templates",
        "discovery_questions",
        "objection_handling",
        "pricing_rules",
        "qualification_framework",
        "follow_up_sequences",
        "proposal_templates",
        "closing_process",
      ],
      portfolio_relationship_type: [
        "owned",
        "co_founded",
        "equity",
        "revenue_share",
        "acquired",
      ],
      priority_level: ["low", "medium", "high", "urgent"],
      product_kind: ["product", "service"],
      project_health: ["healthy", "at_risk", "delayed"],
      project_status: [
        "planning",
        "design",
        "development",
        "qa",
        "client_review",
        "launch",
        "completed",
        "on_hold",
        "cancelled",
      ],
      proposal_status: [
        "draft",
        "ready",
        "published",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
      schedule_status: ["scheduled", "invoiced", "paid", "cancelled"],
      schedule_trigger: [
        "on_signing",
        "on_date",
        "on_milestone",
        "on_completion",
      ],
      stage_category: ["open", "won", "lost"],
      task_status: [
        "pending",
        "in_progress",
        "blocked",
        "completed",
        "cancelled",
        "overdue",
      ],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_for_client",
        "resolved",
        "closed",
      ],
    },
  },
} as const

