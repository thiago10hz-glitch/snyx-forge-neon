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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_live_chats: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_live_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_live_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "admin_live_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          priority: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_presence: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_characters: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          category: string
          chat_count: number
          created_at: string
          creator_id: string
          description: string
          example_dialog: string | null
          first_message: string | null
          id: string
          is_nsfw: boolean
          is_public: boolean
          language: string
          likes_count: number
          name: string
          personality: string
          scenario: string | null
          system_prompt: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          category?: string
          chat_count?: number
          created_at?: string
          creator_id: string
          description?: string
          example_dialog?: string | null
          first_message?: string | null
          id?: string
          is_nsfw?: boolean
          is_public?: boolean
          language?: string
          likes_count?: number
          name: string
          personality?: string
          scenario?: string | null
          system_prompt?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          category?: string
          chat_count?: number
          created_at?: string
          creator_id?: string
          description?: string
          example_dialog?: string | null
          first_message?: string | null
          id?: string
          is_nsfw?: boolean
          is_public?: boolean
          language?: string
          likes_count?: number
          name?: string
          personality?: string
          scenario?: string | null
          system_prompt?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string
          daily_limit: number
          daily_used: number
          id: string
          label: string
          last_error: string | null
          last_reset_at: string
          last_used_at: string | null
          model_default: string | null
          priority: number
          provider: string
          status: string
          total_used: number
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by: string
          daily_limit?: number
          daily_used?: number
          id?: string
          label: string
          last_error?: string | null
          last_reset_at?: string
          last_used_at?: string | null
          model_default?: string | null
          priority?: number
          provider: string
          status?: string
          total_used?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string
          daily_limit?: number
          daily_used?: number
          id?: string
          label?: string
          last_error?: string | null
          last_reset_at?: string
          last_used_at?: string | null
          model_default?: string | null
          priority?: number
          provider?: string
          status?: string
          total_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_clients: {
        Row: {
          api_key: string
          api_key_prefix: string
          created_at: string
          daily_used: number
          expires_at: string | null
          id: string
          last_reset_daily: string
          last_reset_monthly: string
          last_used_at: string | null
          monthly_used: number
          name: string
          plan_id: string
          status: string
          total_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_key_prefix: string
          created_at?: string
          daily_used?: number
          expires_at?: string | null
          id?: string
          last_reset_daily?: string
          last_reset_monthly?: string
          last_used_at?: string | null
          monthly_used?: number
          name?: string
          plan_id: string
          status?: string
          total_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_key_prefix?: string
          created_at?: string
          daily_used?: number
          expires_at?: string | null
          id?: string
          last_reset_daily?: string
          last_reset_monthly?: string
          last_used_at?: string | null
          monthly_used?: number
          name?: string
          plan_id?: string
          status?: string
          total_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "api_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_applications: {
        Row: {
          ai_reasoning: string | null
          ai_score: number | null
          ai_verdict: string | null
          category: string | null
          company_or_project: string
          created_at: string
          estimated_volume: string | null
          full_name: string
          id: string
          ip_address: string | null
          plan_id: string
          project_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          use_case: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          ai_score?: number | null
          ai_verdict?: string | null
          category?: string | null
          company_or_project: string
          created_at?: string
          estimated_volume?: string | null
          full_name: string
          id?: string
          ip_address?: string | null
          plan_id: string
          project_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          use_case: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_score?: number | null
          ai_verdict?: string | null
          category?: string | null
          company_or_project?: string
          created_at?: string
          estimated_volume?: string | null
          full_name?: string
          id?: string
          ip_address?: string | null
          plan_id?: string
          project_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          use_case?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_plans: {
        Row: {
          created_at: string
          daily_request_limit: number
          features: Json
          id: string
          is_active: boolean
          models_allowed: string[]
          monthly_request_limit: number
          name: string
          price_brl: number
          rate_limit_per_minute: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_request_limit?: number
          features?: Json
          id?: string
          is_active?: boolean
          models_allowed?: string[]
          monthly_request_limit?: number
          name: string
          price_brl?: number
          rate_limit_per_minute?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_request_limit?: number
          features?: Json
          id?: string
          is_active?: boolean
          models_allowed?: string[]
          monthly_request_limit?: number
          name?: string
          price_brl?: number
          rate_limit_per_minute?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          api_client_id: string
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          latency_ms: number | null
          model: string | null
          provider: string
          provider_key_id: string | null
          status_code: number
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          api_client_id: string
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          model?: string | null
          provider: string
          provider_key_id?: string | null
          status_code: number
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          api_client_id?: string
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          model?: string | null
          provider?: string
          provider_key_id?: string | null
          status_code?: number
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_provider_key_id_fkey"
            columns: ["provider_key_id"]
            isOneToOne: false
            referencedRelation: "ai_provider_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_releases: {
        Row: {
          changelog: string | null
          created_at: string
          file_size: number | null
          file_url: string
          id: string
          platform: string
          updated_at: string
          uploaded_by: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          file_size?: number | null
          file_url: string
          id?: string
          platform?: string
          updated_at?: string
          uploaded_by: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          file_size?: number | null
          file_url?: string
          id?: string
          platform?: string
          updated_at?: string
          uploaded_by?: string
          version?: string
        }
        Relationships: []
      }
      character_favorites: {
        Row: {
          character_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_favorites_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "ai_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_likes: {
        Row: {
          character_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_likes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "ai_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          character_id: string | null
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "ai_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_customization: {
        Row: {
          ai_avatar_url: string | null
          ai_name: string | null
          ai_personality: string | null
          bg_color: string | null
          bubble_style: string | null
          created_at: string
          id: string
          system_prompt: string | null
          theme_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_avatar_url?: string | null
          ai_name?: string | null
          ai_personality?: string | null
          bg_color?: string | null
          bubble_style?: string | null
          created_at?: string
          id?: string
          system_prompt?: string | null
          theme_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_avatar_url?: string | null
          ai_name?: string | null
          ai_personality?: string | null
          bg_color?: string | null
          bubble_style?: string | null
          created_at?: string
          id?: string
          system_prompt?: string | null
          theme_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          conversation_id: string
          id: string
          message_count_at_summary: number
          summary: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          id?: string
          message_count_at_summary?: number
          summary?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          id?: string
          message_count_at_summary?: number
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          details: string | null
          id: string
          user_id: string
          warning_shown: boolean
        }
        Insert: {
          attempt_type?: string
          created_at?: string
          details?: string | null
          id?: string
          user_id: string
          warning_shown?: boolean
        }
        Update: {
          attempt_type?: string
          created_at?: string
          details?: string | null
          id?: string
          user_id?: string
          warning_shown?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_url: string | null
          banned_until: string | null
          bio: string | null
          created_at: string
          dev_expires_at: string | null
          display_name: string | null
          free_messages_used: number
          gender: string | null
          id: string
          is_dev: boolean
          is_pack_steam: boolean
          is_rpg_premium: boolean
          is_vip: boolean
          last_free_message_at: string | null
          pack_steam_expires_at: string | null
          partner_user_id: string | null
          relationship_status: string | null
          rpg_premium_expires_at: string | null
          team_badge: string | null
          updated_at: string
          user_id: string
          vip_expires_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          background_url?: string | null
          banned_until?: string | null
          bio?: string | null
          created_at?: string
          dev_expires_at?: string | null
          display_name?: string | null
          free_messages_used?: number
          gender?: string | null
          id?: string
          is_dev?: boolean
          is_pack_steam?: boolean
          is_rpg_premium?: boolean
          is_vip?: boolean
          last_free_message_at?: string | null
          pack_steam_expires_at?: string | null
          partner_user_id?: string | null
          relationship_status?: string | null
          rpg_premium_expires_at?: string | null
          team_badge?: string | null
          updated_at?: string
          user_id: string
          vip_expires_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          background_url?: string | null
          banned_until?: string | null
          bio?: string | null
          created_at?: string
          dev_expires_at?: string | null
          display_name?: string | null
          free_messages_used?: number
          gender?: string | null
          id?: string
          is_dev?: boolean
          is_pack_steam?: boolean
          is_rpg_premium?: boolean
          is_vip?: boolean
          last_free_message_at?: string | null
          pack_steam_expires_at?: string | null
          partner_user_id?: string | null
          relationship_status?: string | null
          rpg_premium_expires_at?: string | null
          team_badge?: string | null
          updated_at?: string
          user_id?: string
          vip_expires_at?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          resource: string | null
          severity: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          resource?: string | null
          severity?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          resource?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id: string
          sender_role?: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tracking: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_force_set_dev: {
        Args: { p_expires_at?: string; p_is_dev: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_grant_pack_steam: {
        Args: { p_months: number; p_target_user_id: string }
        Returns: Json
      }
      admin_grant_rpg_premium: {
        Args: { p_months: number; p_target_user_id: string }
        Returns: Json
      }
      admin_grant_vip: {
        Args: { p_months: number; p_target_user_id: string }
        Returns: Json
      }
      admin_revoke_pack_steam: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_revoke_rpg_premium: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_revoke_vip: { Args: { p_target_user_id: string }; Returns: Json }
      admin_set_partner: {
        Args: { p_user1_id: string; p_user2_id: string }
        Returns: Json
      }
      admin_set_team_badge: {
        Args: { p_badge?: string; p_user_id: string }
        Returns: Json
      }
      can_send_message: { Args: never; Returns: Json }
      check_fingerprint: { Args: { p_fingerprint: string }; Returns: Json }
      check_ip_duplicate: {
        Args: { p_ip: string; p_user_id?: string }
        Returns: Json
      }
      find_user_by_email: { Args: { p_email: string }; Returns: string }
      get_next_ai_key: {
        Args: { p_provider?: string }
        Returns: {
          api_key: string
          id: string
          model_default: string
          provider: string
        }[]
      }
      get_partner_user_id: { Args: { _user_id: string }; Returns: string }
      handle_security_violation: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_key_usage: { Args: { p_key_id: string }; Returns: undefined }
      increment_api_client_usage: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      increment_character_chat_count: {
        Args: { p_character_id: string }
        Returns: undefined
      }
      increment_free_messages: { Args: never; Returns: undefined }
      mark_ai_key_error: {
        Args: { p_error: string; p_key_id: string }
        Returns: undefined
      }
      reset_daily_ai_usage: { Args: never; Returns: undefined }
      validate_api_client: { Args: { p_api_key: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
