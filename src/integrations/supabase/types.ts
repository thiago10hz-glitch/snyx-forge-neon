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
      accelerator_keys: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_key: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          linked_imei: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_key: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          linked_imei?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_key?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          linked_imei?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      chat_connections: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          requester_id: string
          status: string
          target_email: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          target_email: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          target_email?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      chat_shared_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          room_id: string
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role?: string
          room_id: string
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          room_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_shared_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_shared_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_shared_rooms: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_shared_rooms_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "chat_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      clone_demos: {
        Row: {
          created_at: string
          demo_url: string | null
          description: string | null
          device_fingerprint: string | null
          expires_at: string
          hosted_url: string | null
          id: string
          ip_address: string | null
          primary_color: string
          site_name: string
          status: string
          user_id: string
          vercel_deployment_id: string | null
          vercel_project_id: string | null
        }
        Insert: {
          created_at?: string
          demo_url?: string | null
          description?: string | null
          device_fingerprint?: string | null
          expires_at?: string
          hosted_url?: string | null
          id?: string
          ip_address?: string | null
          primary_color?: string
          site_name: string
          status?: string
          user_id: string
          vercel_deployment_id?: string | null
          vercel_project_id?: string | null
        }
        Update: {
          created_at?: string
          demo_url?: string | null
          description?: string | null
          device_fingerprint?: string | null
          expires_at?: string
          hosted_url?: string | null
          id?: string
          ip_address?: string | null
          primary_color?: string
          site_name?: string
          status?: string
          user_id?: string
          vercel_deployment_id?: string | null
          vercel_project_id?: string | null
        }
        Relationships: []
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
      hosted_sites: {
        Row: {
          created_at: string
          custom_domain: string | null
          html_content: string
          id: string
          site_name: string
          status: string
          updated_at: string
          user_id: string
          vercel_project_id: string | null
          vercel_url: string | null
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          html_content: string
          id?: string
          site_name: string
          status?: string
          updated_at?: string
          user_id: string
          vercel_project_id?: string | null
          vercel_url?: string | null
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          html_content?: string
          id?: string
          site_name?: string
          status?: string
          updated_at?: string
          user_id?: string
          vercel_project_id?: string | null
          vercel_url?: string | null
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
          hosting_tier: string
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
          hosting_tier?: string
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
          hosting_tier?: string
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
      rpg_player_characters: {
        Row: {
          avatar_url: string | null
          backstory: string | null
          class: string
          created_at: string
          id: string
          is_active: boolean
          level: number
          name: string
          personality: string | null
          race: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          backstory?: string | null
          class?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name: string
          personality?: string | null
          race?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          backstory?: string | null
          class?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          personality?: string | null
          race?: string
          updated_at?: string
          user_id?: string
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
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
      video_generations: {
        Row: {
          created_at: string
          id: string
          mode: string
          prompt: string
          result_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          prompt: string
          result_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          prompt?: string
          result_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_call_history: {
        Row: {
          created_at: string
          gender: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
          voice_id: string
        }
        Insert: {
          created_at?: string
          gender?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
          voice_id: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: []
      }
      vpn_peers: {
        Row: {
          activated_with_key: string | null
          assigned_ip: string
          created_at: string
          dns_servers: string
          id: string
          is_active: boolean
          peer_private_key: string
          peer_public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_with_key?: string | null
          assigned_ip: string
          created_at?: string
          dns_servers?: string
          id?: string
          is_active?: boolean
          peer_private_key: string
          peer_public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_with_key?: string | null
          assigned_ip?: string
          created_at?: string
          dns_servers?: string
          id?: string
          is_active?: boolean
          peer_private_key?: string
          peer_public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vpn_peers_activated_with_key_fkey"
            columns: ["activated_with_key"]
            isOneToOne: false
            referencedRelation: "accelerator_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      vpn_server_config: {
        Row: {
          created_at: string
          id: string
          is_setup: boolean
          listen_port: number
          server_ip: string
          server_private_key: string
          server_public_key: string
          server_subnet: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_setup?: boolean
          listen_port?: number
          server_ip: string
          server_private_key: string
          server_public_key: string
          server_subnet?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_setup?: boolean
          listen_port?: number
          server_ip?: string
          server_private_key?: string
          server_public_key?: string
          server_subnet?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_accelerator_key: { Args: { p_key: string }; Returns: Json }
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
      admin_revoke_hosting: { Args: { p_user_id: string }; Returns: Json }
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
      can_use_demo: {
        Args: { p_fingerprint?: string; p_ip?: string }
        Returns: Json
      }
      check_fingerprint: { Args: { p_fingerprint: string }; Returns: Json }
      check_hosting_limit: { Args: never; Returns: Json }
      check_ip_duplicate: {
        Args: { p_ip: string; p_user_id?: string }
        Returns: Json
      }
      cleanup_expired_demos: { Args: never; Returns: number }
      find_user_by_email: { Args: { p_email: string }; Returns: string }
      generate_accelerator_key: {
        Args: { p_expires_months?: number }
        Returns: Json
      }
      get_my_vpn_config: { Args: never; Returns: Json }
      get_partner_user_id: { Args: { _user_id: string }; Returns: string }
      handle_security_violation: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: Json
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_character_chat_count: {
        Args: { p_character_id: string }
        Returns: undefined
      }
      increment_free_messages: { Args: never; Returns: undefined }
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
