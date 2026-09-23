export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          tasks: Json
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          tasks?: Json
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          tasks?: Json
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_edit_memory: {
        Row: {
          confidence: number
          created_at: string
          id: string
          signal_type: string
          signal_value: string
          source: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          signal_type: string
          signal_value: string
          source?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          signal_type?: string
          signal_value?: string
          source?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      architecta_campaigns: {
        Row: {
          created_at: string
          goal: string | null
          id: string
          launch_date: string | null
          meta: Json
          name: string
          status: string
          strategy_id: string | null
          theme: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          goal?: string | null
          id?: string
          launch_date?: string | null
          meta?: Json
          name: string
          status?: string
          strategy_id?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          goal?: string | null
          id?: string
          launch_date?: string | null
          meta?: Json
          name?: string
          status?: string
          strategy_id?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "architecta_campaigns_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "architecta_content_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      architecta_content_calendar_items: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          notes: string | null
          platform: string
          post_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          platform: string
          post_id?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          platform?: string
          post_id?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "architecta_content_calendar_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "architecta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "architecta_content_calendar_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "architecta_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      architecta_content_strategies: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          audience_angles: Json
          brand_profile_id: string | null
          campaigns_seed: Json
          content_themes: Json
          created_at: string
          id: string
          next_actions: Json
          pillars: Json
          platform_strategy: Json
          posting_cadence: Json
          quick_wins: Json
          source_input: Json
          status: string
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          audience_angles?: Json
          brand_profile_id?: string | null
          campaigns_seed?: Json
          content_themes?: Json
          created_at?: string
          id?: string
          next_actions?: Json
          pillars?: Json
          platform_strategy?: Json
          posting_cadence?: Json
          quick_wins?: Json
          source_input?: Json
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          audience_angles?: Json
          brand_profile_id?: string | null
          campaigns_seed?: Json
          content_themes?: Json
          created_at?: string
          id?: string
          next_actions?: Json
          pillars?: Json
          platform_strategy?: Json
          posting_cadence?: Json
          quick_wins?: Json
          source_input?: Json
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "architecta_content_strategies_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      architecta_generated_assets: {
        Row: {
          asset_type: string
          created_at: string
          duration_seconds: number | null
          external_url: string | null
          height: number | null
          id: string
          meta: Json
          model: string
          post_id: string | null
          prompt: string
          provider: string
          storage_bucket: string | null
          storage_path: string | null
          user_id: string
          width: number | null
          workspace_id: string | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          duration_seconds?: number | null
          external_url?: string | null
          height?: number | null
          id?: string
          meta?: Json
          model: string
          post_id?: string | null
          prompt: string
          provider: string
          storage_bucket?: string | null
          storage_path?: string | null
          user_id: string
          width?: number | null
          workspace_id?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          duration_seconds?: number | null
          external_url?: string | null
          height?: number | null
          id?: string
          meta?: Json
          model?: string
          post_id?: string | null
          prompt?: string
          provider?: string
          storage_bucket?: string | null
          storage_path?: string | null
          user_id?: string
          width?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "architecta_generated_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "architecta_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      architecta_llm_usage: {
        Row: {
          cost_usd: number
          created_at: string
          id: number
          input_tokens: number
          latency_ms: number | null
          meta: Json
          model: string
          output_tokens: number
          provider: string
          request_id: string | null
          route_reason: string | null
          task: string
          tier: string | null
          total_tokens: number
          used_fallback: boolean
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: number
          input_tokens?: number
          latency_ms?: number | null
          meta?: Json
          model: string
          output_tokens?: number
          provider: string
          request_id?: string | null
          route_reason?: string | null
          task: string
          tier?: string | null
          total_tokens?: number
          used_fallback?: boolean
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: number
          input_tokens?: number
          latency_ms?: number | null
          meta?: Json
          model?: string
          output_tokens?: number
          provider?: string
          request_id?: string | null
          route_reason?: string | null
          task?: string
          tier?: string | null
          total_tokens?: number
          used_fallback?: boolean
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      architecta_posts: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          body: string | null
          campaign_id: string | null
          caption: string | null
          created_at: string
          cta: string | null
          hashtags: string[]
          hook: string | null
          id: string
          image_asset_id: string | null
          image_prompt: string | null
          meta: Json
          publish_attempts: number
          publish_claimed_at: string | null
          publish_error: string | null
          publish_error_code: string | null
          platform: string
          published_at: string | null
          scheduled_for: string | null
          status: string
          strategy_id: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_asset_id: string | null
          video_prompt: string | null
          workspace_id: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          body?: string | null
          campaign_id?: string | null
          caption?: string | null
          created_at?: string
          cta?: string | null
          hashtags?: string[]
          hook?: string | null
          id?: string
          image_asset_id?: string | null
          image_prompt?: string | null
          meta?: Json
          publish_attempts?: number
          publish_claimed_at?: string | null
          publish_error?: string | null
          publish_error_code?: string | null
          platform: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          strategy_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_asset_id?: string | null
          video_prompt?: string | null
          workspace_id?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          body?: string | null
          campaign_id?: string | null
          caption?: string | null
          created_at?: string
          cta?: string | null
          hashtags?: string[]
          hook?: string | null
          id?: string
          image_asset_id?: string | null
          image_prompt?: string | null
          meta?: Json
          publish_attempts?: number
          publish_claimed_at?: string | null
          publish_error?: string | null
          publish_error_code?: string | null
          platform?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          strategy_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_asset_id?: string | null
          video_prompt?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "architecta_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "architecta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "architecta_posts_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "architecta_content_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      architecta_user_settings: {
        Row: {
          anthropic_model: string
          approval_required: boolean
          created_at: string
          default_platforms: string[]
          image_style: Json
          openai_image_model: string
          openai_text_model: string
          openai_video_model: string | null
          text_provider: string
          updated_at: string
          user_id: string
          video_style: Json
          workspace_id: string | null
        }
        Insert: {
          anthropic_model?: string
          approval_required?: boolean
          created_at?: string
          default_platforms?: string[]
          image_style?: Json
          openai_image_model?: string
          openai_text_model?: string
          openai_video_model?: string | null
          text_provider?: string
          updated_at?: string
          user_id: string
          video_style?: Json
          workspace_id?: string | null
        }
        Update: {
          anthropic_model?: string
          approval_required?: boolean
          created_at?: string
          default_platforms?: string[]
          image_style?: Json
          openai_image_model?: string
          openai_text_model?: string
          openai_video_model?: string | null
          text_provider?: string
          updated_at?: string
          user_id?: string
          video_style?: Json
          workspace_id?: string | null
        }
        Relationships: []
      }
      brand_profiles: {
        Row: {
          ai_preferences: Json | null
          audience: string | null
          banned_phrases: string[] | null
          brand_name: string | null
          created_at: string
          description: string | null
          example_posts: Json | null
          id: string
          industry: string | null
          mission: string | null
          offers: string | null
          required_elements: string[] | null
          source: Json | null
          tone: string | null
          tone_voice: string | null
          topics: Json | null
          typical_customers: string | null
          updated_at: string
          user_id: string
          values: string | null
          vision: string | null
          voice_description: string | null
          website: string | null
        }
        Insert: {
          ai_preferences?: Json | null
          audience?: string | null
          banned_phrases?: string[] | null
          brand_name?: string | null
          created_at?: string
          description?: string | null
          example_posts?: Json | null
          id?: string
          industry?: string | null
          mission?: string | null
          offers?: string | null
          required_elements?: string[] | null
          source?: Json | null
          tone?: string | null
          tone_voice?: string | null
          topics?: Json | null
          typical_customers?: string | null
          updated_at?: string
          user_id: string
          values?: string | null
          vision?: string | null
          voice_description?: string | null
          website?: string | null
        }
        Update: {
          ai_preferences?: Json | null
          audience?: string | null
          banned_phrases?: string[] | null
          brand_name?: string | null
          created_at?: string
          description?: string | null
          example_posts?: Json | null
          id?: string
          industry?: string | null
          mission?: string | null
          offers?: string | null
          required_elements?: string[] | null
          source?: Json | null
          tone?: string | null
          tone_voice?: string | null
          topics?: Json | null
          typical_customers?: string | null
          updated_at?: string
          user_id?: string
          values?: string | null
          vision?: string | null
          voice_description?: string | null
          website?: string | null
        }
        Relationships: []
      }
      founder_style_profiles: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          profile_text: string
          updated_at: string
          user_id: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          profile_text: string
          updated_at?: string
          user_id: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          profile_text?: string
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      memory_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      onboarding_sessions: {
        Row: {
          answers: Json | null
          app: string
          completed_steps: string[] | null
          created_at: string
          current_step: string | null
          flags: Json | null
          id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          app: string
          completed_steps?: string[] | null
          created_at?: string
          current_step?: string | null
          flags?: Json | null
          id?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          app?: string
          completed_steps?: string[] | null
          created_at?: string
          current_step?: string | null
          flags?: Json | null
          id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          is_premium: boolean
          onboarding_complete: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          plan_tier: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          is_premium?: boolean
          onboarding_complete?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          plan_tier?: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_premium?: boolean
          onboarding_complete?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          plan_tier?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_graphs: {
        Row: {
          created_at: string
          graph: Json
          id: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          graph?: Json
          id?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          graph?: Json
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
