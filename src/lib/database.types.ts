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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          audit_id: string
          changed_at: string
          changed_by: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string
          record_key: Json | null
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          audit_id?: string
          changed_at?: string
          changed_by?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          record_key?: Json | null
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          audit_id?: string
          changed_at?: string
          changed_by?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          record_key?: Json | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          branch_served: Database["public"]["Enums"]["branch_type"]
          client_id: string
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          contact_channel: Database["public"]["Enums"]["contact_channel"]
          created_at: string
          email: string | null
          first_name: string | null
          last_name: string | null
          name: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          branch_served: Database["public"]["Enums"]["branch_type"]
          client_id?: string
          client_type: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          contact_channel: Database["public"]["Enums"]["contact_channel"]
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          branch_served?: Database["public"]["Enums"]["branch_type"]
          client_id?: string
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          contact_channel?: Database["public"]["Enums"]["contact_channel"]
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      field_reports: {
        Row: {
          additional_notes: string | null
          client_signoff: boolean
          client_signoff_name: string | null
          created_at: string
          filed_by_user_id: string | null
          issue_description: string | null
          job_id: string
          recommendations: string | null
          report_id: string
          report_number: string
          review_status: Database["public"]["Enums"]["report_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          service_date: string
          site_address: string | null
          submitted_at: string | null
          technician_id: string
          time_arrival: string | null
          work_performed: string
        }
        Insert: {
          additional_notes?: string | null
          client_signoff?: boolean
          client_signoff_name?: string | null
          created_at?: string
          filed_by_user_id?: string | null
          issue_description?: string | null
          job_id: string
          recommendations?: string | null
          report_id?: string
          report_number?: string
          review_status?: Database["public"]["Enums"]["report_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_date: string
          site_address?: string | null
          submitted_at?: string | null
          technician_id: string
          time_arrival?: string | null
          work_performed: string
        }
        Update: {
          additional_notes?: string | null
          client_signoff?: boolean
          client_signoff_name?: string | null
          created_at?: string
          filed_by_user_id?: string | null
          issue_description?: string | null
          job_id?: string
          recommendations?: string | null
          report_id?: string
          report_number?: string
          review_status?: Database["public"]["Enums"]["report_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_date?: string
          site_address?: string | null
          submitted_at?: string | null
          technician_id?: string
          time_arrival?: string | null
          work_performed?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_reports_filed_by_user_id_fkey"
            columns: ["filed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "field_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "field_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "warehouse_queue"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "field_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "field_reports_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["technician_id"]
          },
          {
            foreignKeyName: "fk_field_report_assigned_technician"
            columns: ["job_id", "technician_id"]
            isOneToOne: false
            referencedRelation: "job_technicians"
            referencedColumns: ["job_id", "technician_id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          description: string
          invoice_id: string
          line_item_id: string
          line_total: number | null
          quantity: number
          unit_price: number
        }
        Insert: {
          description: string
          invoice_id: string
          line_item_id?: string
          line_total?: number | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          description?: string
          invoice_id?: string
          line_item_id?: string
          line_total?: number | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          invoice_id: string
          invoice_number: string
          issue_date: string
          job_id: string
          quotation_id: string | null
          report_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          invoice_id?: string
          invoice_number?: string
          issue_date?: string
          job_id: string
          quotation_id?: string | null
          report_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          invoice_id?: string
          invoice_number?: string
          issue_date?: string
          job_id?: string
          quotation_id?: string | null
          report_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_job_client"
            columns: ["job_id", "client_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id", "client_id"]
          },
          {
            foreignKeyName: "fk_invoice_report_same_job"
            columns: ["report_id", "job_id"]
            isOneToOne: false
            referencedRelation: "field_reports"
            referencedColumns: ["report_id", "job_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "warehouse_queue"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "invoices_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "field_reports"
            referencedColumns: ["report_id"]
          },
        ]
      }
      job_parts: {
        Row: {
          job_id: string
          job_part_id: string
          part_id: string
          quantity: number
          reserved_at: string
          reserved_by: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          job_id: string
          job_part_id?: string
          part_id: string
          quantity: number
          reserved_at?: string
          reserved_by: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          job_id?: string
          job_part_id?: string
          part_id?: string
          quantity?: number
          reserved_at?: string
          reserved_by?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "warehouse_queue"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "job_parts_reserved_by_fkey"
            columns: ["reserved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_technicians: {
        Row: {
          is_active: boolean
          job_id: string
          schedule_range: unknown
          technician_id: string
        }
        Insert: {
          is_active: boolean
          job_id: string
          schedule_range: unknown
          technician_id: string
        }
        Update: {
          is_active?: boolean
          job_id?: string
          schedule_range?: unknown
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_technicians_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_technicians_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "warehouse_queue"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_technicians_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      job_template_items: {
        Row: {
          description: string
          item_id: string
          line_total: number | null
          line_type: Database["public"]["Enums"]["quotation_line_type"]
          part_id: string | null
          quantity: number
          template_id: string
          unit_price: number
        }
        Insert: {
          description: string
          item_id?: string
          line_total?: number | null
          line_type: Database["public"]["Enums"]["quotation_line_type"]
          part_id?: string | null
          quantity?: number
          template_id: string
          unit_price?: number
        }
        Update: {
          description?: string
          item_id?: string
          line_total?: number | null
          line_type?: Database["public"]["Enums"]["quotation_line_type"]
          part_id?: string | null
          quantity?: number
          template_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_template_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "job_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      job_templates: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"] | null
          created_at: string
          created_by: string | null
          description: string | null
          is_active: boolean
          job_type: Database["public"]["Enums"]["job_type"]
          markup_percent: number
          name: string
          template_id: string
          updated_at: string
        }
        Insert: {
          branch?: Database["public"]["Enums"]["branch_type"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          is_active?: boolean
          job_type: Database["public"]["Enums"]["job_type"]
          markup_percent?: number
          name: string
          template_id?: string
          updated_at?: string
        }
        Update: {
          branch?: Database["public"]["Enums"]["branch_type"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          markup_percent?: number
          name?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      jobs: {
        Row: {
          assignment_confirmed_at: string | null
          branch: Database["public"]["Enums"]["branch_type"]
          client_id: string
          created_at: string
          created_by: string
          job_id: string
          job_number: string
          job_type: Database["public"]["Enums"]["job_type"]
          parts_confirmed_at: string | null
          parts_confirmed_by: string | null
          parts_status: Database["public"]["Enums"]["parts_status"]
          quotation_id: string | null
          schedule_range: unknown
          scheduled_date: string
          scheduled_end_date: string
          scheduled_end_time: string
          scheduled_time: string
          site_address: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          assignment_confirmed_at?: string | null
          branch: Database["public"]["Enums"]["branch_type"]
          client_id: string
          created_at?: string
          created_by: string
          job_id?: string
          job_number?: string
          job_type: Database["public"]["Enums"]["job_type"]
          parts_confirmed_at?: string | null
          parts_confirmed_by?: string | null
          parts_status?: Database["public"]["Enums"]["parts_status"]
          quotation_id?: string | null
          schedule_range?: unknown
          scheduled_date: string
          scheduled_end_date: string
          scheduled_end_time: string
          scheduled_time: string
          site_address?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          assignment_confirmed_at?: string | null
          branch?: Database["public"]["Enums"]["branch_type"]
          client_id?: string
          created_at?: string
          created_by?: string
          job_id?: string
          job_number?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          parts_confirmed_at?: string | null
          parts_confirmed_by?: string | null
          parts_status?: Database["public"]["Enums"]["parts_status"]
          quotation_id?: string | null
          schedule_range?: unknown
          scheduled_date?: string
          scheduled_end_date?: string
          scheduled_end_time?: string
          scheduled_time?: string
          site_address?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "jobs_parts_confirmed_by_fkey"
            columns: ["parts_confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "jobs_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["quotation_id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          module: Database["public"]["Enums"]["module_name"]
          permission_id: string
          role_id: string
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          module: Database["public"]["Enums"]["module_name"]
          permission_id?: string
          role_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          module?: Database["public"]["Enums"]["module_name"]
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      part_categories: {
        Row: {
          category_id: string
          code_prefix: string
          created_at: string
          created_by: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          category_id?: string
          code_prefix: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          category_id?: string
          code_prefix?: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      parts: {
        Row: {
          address: string | null
          category: string | null
          category_id: string | null
          created_at: string
          is_active: boolean
          name: string
          notes: string | null
          part_id: string
          reorder_threshold: number
          sku: string
          unit_cost: number
          unit_of_measure: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          is_active?: boolean
          name: string
          notes?: string | null
          part_id?: string
          reorder_threshold?: number
          sku: string
          unit_cost?: number
          unit_of_measure: string
        }
        Update: {
          address?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          part_id?: string
          reorder_threshold?: number
          sku?: string
          unit_cost?: number
          unit_of_measure?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "part_categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          email: string
          expires_at: string
          handled_at: string | null
          handled_by: string | null
          request_id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          email: string
          expires_at?: string
          handled_at?: string | null
          handled_by?: string | null
          request_id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          email?: string
          expires_at?: string
          handled_at?: string | null
          handled_by?: string | null
          request_id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "password_reset_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          payment_date: string
          payment_id: string
          received_by: string
        }
        Insert: {
          amount: number
          created_at?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          payment_date?: string
          payment_id?: string
          received_by: string
        }
        Update: {
          amount?: number
          created_at?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          payment_date?: string
          payment_id?: string
          received_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quotation_line_items: {
        Row: {
          description: string
          line_item_id: string
          line_total: number | null
          line_type: Database["public"]["Enums"]["quotation_line_type"]
          part_id: string | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          description: string
          line_item_id?: string
          line_total?: number | null
          line_type: Database["public"]["Enums"]["quotation_line_type"]
          part_id?: string | null
          quantity?: number
          quotation_id: string
          unit_price?: number
        }
        Update: {
          description?: string
          line_item_id?: string
          line_total?: number | null
          line_type?: Database["public"]["Enums"]["quotation_line_type"]
          part_id?: string | null
          quantity?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_line_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "quotation_line_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["quotation_id"]
          },
        ]
      }
      quotations: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          branch: Database["public"]["Enums"]["branch_type"]
          client_id: string
          created_at: string
          issue_date: string
          job_type: Database["public"]["Enums"]["job_type"]
          notes: string | null
          prepared_by: string
          quotation_id: string
          quotation_number: string
          site_address: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          template_id: string | null
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          branch: Database["public"]["Enums"]["branch_type"]
          client_id: string
          created_at?: string
          issue_date?: string
          job_type: Database["public"]["Enums"]["job_type"]
          notes?: string | null
          prepared_by: string
          quotation_id?: string
          quotation_number?: string
          site_address?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          template_id?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          branch?: Database["public"]["Enums"]["branch_type"]
          client_id?: string
          created_at?: string
          issue_date?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          notes?: string | null
          prepared_by?: string
          quotation_id?: string
          quotation_number?: string
          site_address?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          template_id?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotations_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          attachment_id: string
          file_type: Database["public"]["Enums"]["attachment_type"]
          file_url: string
          report_id: string
          uploaded_at: string
        }
        Insert: {
          attachment_id?: string
          file_type: Database["public"]["Enums"]["attachment_type"]
          file_url: string
          report_id: string
          uploaded_at?: string
        }
        Update: {
          attachment_id?: string
          file_type?: Database["public"]["Enums"]["attachment_type"]
          file_url?: string
          report_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "field_reports"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_parts_used: {
        Row: {
          part_id: string
          quantity: number
          report_id: string
          report_part_id: string
          stock_movement_id: string | null
        }
        Insert: {
          part_id: string
          quantity: number
          report_id: string
          report_part_id?: string
          stock_movement_id?: string | null
        }
        Update: {
          part_id?: string
          quantity?: number
          report_id?: string
          report_part_id?: string
          stock_movement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_parts_used_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "report_parts_used_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "field_reports"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "report_parts_used_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["movement_id"]
          },
        ]
      }
      requisitions: {
        Row: {
          approved_by: string | null
          branch: Database["public"]["Enums"]["branch_type"]
          created_at: string
          part_id: string
          quantity_requested: number
          requested_by: string
          requisition_id: string
          requisition_number: string
          status: Database["public"]["Enums"]["requisition_status"]
          supplier_reference: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          branch: Database["public"]["Enums"]["branch_type"]
          created_at?: string
          part_id: string
          quantity_requested: number
          requested_by: string
          requisition_id?: string
          requisition_number?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          supplier_reference?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          branch?: Database["public"]["Enums"]["branch_type"]
          created_at?: string
          part_id?: string
          quantity_requested?: number
          requested_by?: string
          requisition_id?: string
          requisition_number?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          supplier_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "requisitions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "requisitions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      roles: {
        Row: {
          role_id: string
          role_name: string
        }
        Insert: {
          role_id?: string
          role_name: string
        }
        Update: {
          role_id?: string
          role_name?: string
        }
        Relationships: []
      }
      stock: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"]
          part_id: string
          quantity_on_hand: number
          quantity_reserved: number
          stock_id: string
          updated_at: string
        }
        Insert: {
          branch: Database["public"]["Enums"]["branch_type"]
          part_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          stock_id?: string
          updated_at?: string
        }
        Update: {
          branch?: Database["public"]["Enums"]["branch_type"]
          part_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          stock_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"]
          created_at: string
          direction: Database["public"]["Enums"]["movement_direction"]
          movement_id: string
          part_id: string
          performed_by: string
          quantity: number
          reason: Database["public"]["Enums"]["movement_reason"]
          related_job_id: string | null
          related_job_part_id: string | null
          related_requisition_id: string | null
        }
        Insert: {
          branch: Database["public"]["Enums"]["branch_type"]
          created_at?: string
          direction: Database["public"]["Enums"]["movement_direction"]
          movement_id?: string
          part_id: string
          performed_by: string
          quantity: number
          reason: Database["public"]["Enums"]["movement_reason"]
          related_job_id?: string | null
          related_job_part_id?: string | null
          related_requisition_id?: string | null
        }
        Update: {
          branch?: Database["public"]["Enums"]["branch_type"]
          created_at?: string
          direction?: Database["public"]["Enums"]["movement_direction"]
          movement_id?: string
          part_id?: string
          performed_by?: string
          quantity?: number
          reason?: Database["public"]["Enums"]["movement_reason"]
          related_job_id?: string | null
          related_job_part_id?: string | null
          related_requisition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_movement_requisition"
            columns: ["related_requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["requisition_id"]
          },
          {
            foreignKeyName: "stock_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "stock_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_movements_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "warehouse_queue"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_related_job_part_id_fkey"
            columns: ["related_job_part_id"]
            isOneToOne: false
            referencedRelation: "job_parts"
            referencedColumns: ["job_part_id"]
          },
        ]
      }
      technicians: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"]
          contact_phone: string | null
          specialization: string | null
          technician_id: string
          user_id: string
        }
        Insert: {
          branch: Database["public"]["Enums"]["branch_type"]
          contact_phone?: string | null
          specialization?: string | null
          technician_id?: string
          user_id: string
        }
        Update: {
          branch?: Database["public"]["Enums"]["branch_type"]
          contact_phone?: string | null
          specialization?: string | null
          technician_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"] | null
          created_at: string
          email: string
          first_name: string
          is_active: boolean
          last_name: string
          password_hash: string
          phone: string | null
          photo_path: string | null
          role_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: Database["public"]["Enums"]["branch_type"] | null
          created_at?: string
          email: string
          first_name: string
          is_active?: boolean
          last_name: string
          password_hash: string
          phone?: string | null
          photo_path?: string | null
          role_id: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch?: Database["public"]["Enums"]["branch_type"] | null
          created_at?: string
          email?: string
          first_name?: string
          is_active?: boolean
          last_name?: string
          password_hash?: string
          phone?: string | null
          photo_path?: string | null
          role_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
    }
    Views: {
      stock_available: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"] | null
          is_low: boolean | null
          part_id: string | null
          part_name: string | null
          quantity_available: number | null
          quantity_on_hand: number | null
          quantity_reserved: number | null
          reorder_threshold: number | null
          sku: string | null
          stock_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["part_id"]
          },
        ]
      }
      warehouse_queue: {
        Row: {
          branch: Database["public"]["Enums"]["branch_type"] | null
          client_name: string | null
          job_id: string | null
          job_number: string | null
          job_type: Database["public"]["Enums"]["job_type"] | null
          scheduled_date: string | null
          scheduled_time: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      gioms_confirm_job_assignment: {
        Args: { p_actor: string; p_job_number: string }
        Returns: Json
      }
      gioms_create_invoice_from_report: {
        Args: { p_due_date: string; p_extra_lines: Json; p_report_id: string }
        Returns: Json
      }
      gioms_create_job_from_template: {
        Args: {
          p_accepted_by_name: string
          p_actor: string
          p_branch: Database["public"]["Enums"]["branch_type"]
          p_client_id: string
          p_client_type: string
          p_company_name: string
          p_date: string
          p_email: string
          p_end_time: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_site_address: string
          p_start_time: string
          p_technician_ids: string[]
          p_template_id: string
        }
        Returns: Json
      }
      gioms_current_actor: { Args: never; Returns: string }
      gioms_format_number: {
        Args: { p_prefix: string; p_value: number }
        Returns: string
      }
      gioms_record_invoice_payment: {
        Args: {
          p_actor: string
          p_amount: number
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_on: string
        }
        Returns: Json
      }
      gioms_reserve_job_stock: {
        Args: { p_items: Json; p_job_number: string; p_reserved_by: string }
        Returns: Json
      }
      gioms_save_job_template: {
        Args: {
          p_actor: string
          p_branch: Database["public"]["Enums"]["branch_type"]
          p_description: string
          p_is_active: boolean
          p_items: Json
          p_job_type: Database["public"]["Enums"]["job_type"]
          p_markup_percent: number
          p_name: string
          p_template_id: string
        }
        Returns: string
      }
      gioms_submit_field_report: {
        Args: {
          p_additional_notes: string
          p_attachments?: Json
          p_client_signoff: boolean
          p_client_signoff_name: string
          p_issue_description: string
          p_job_id: string
          p_recommendations: string
          p_service_date: string
          p_site_address: string
          p_technician_id: string
          p_time_arrival: string
          p_work_performed: string
        }
        Returns: Json
      }
      gioms_submit_field_report_with_usage: {
        Args: {
          p_additional_notes: string
          p_attachments?: Json
          p_client_signoff: boolean
          p_client_signoff_name: string
          p_issue_description: string
          p_job_id: string
          p_recommendations: string
          p_service_date: string
          p_site_address: string
          p_technician_id: string
          p_time_arrival: string
          p_used_parts: Json
          p_work_performed: string
        }
        Returns: Json
      }
    }
    Enums: {
      access_level: "view" | "edit" | "approve"
      attachment_type: "photo" | "document" | "signature"
      audit_action: "insert" | "update" | "delete"
      branch_type: "makati" | "cebu"
      client_type: "individual" | "company"
      contact_channel:
        | "hotline"
        | "website"
        | "facebook"
        | "email"
        | "referral"
        | "walk_in"
      invoice_status: "pending" | "paid" | "overdue" | "cancelled"
      job_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      job_type: "installation" | "maintenance" | "repair" | "inspection"
      module_name:
        | "scheduling"
        | "inventory"
        | "field_reporting"
        | "sales_billing"
        | "admin"
      movement_direction: "in" | "out"
      movement_reason: "job_usage" | "restock" | "transfer" | "adjustment"
      parts_status: "pending" | "confirmed" | "not_required"
      payment_method: "cash" | "check" | "bank_transfer" | "online"
      quotation_line_type: "parts" | "labor" | "transport" | "other"
      quotation_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      report_review_status: "draft" | "submitted" | "approved" | "returned"
      requisition_status: "pending" | "approved" | "rejected" | "fulfilled"
      reservation_status: "reserved" | "released" | "consumed"
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
  public: {
    Enums: {
      access_level: ["view", "edit", "approve"],
      attachment_type: ["photo", "document", "signature"],
      audit_action: ["insert", "update", "delete"],
      branch_type: ["makati", "cebu"],
      client_type: ["individual", "company"],
      contact_channel: [
        "hotline",
        "website",
        "facebook",
        "email",
        "referral",
        "walk_in",
      ],
      invoice_status: ["pending", "paid", "overdue", "cancelled"],
      job_status: ["scheduled", "in_progress", "completed", "cancelled"],
      job_type: ["installation", "maintenance", "repair", "inspection"],
      module_name: [
        "scheduling",
        "inventory",
        "field_reporting",
        "sales_billing",
        "admin",
      ],
      movement_direction: ["in", "out"],
      movement_reason: ["job_usage", "restock", "transfer", "adjustment"],
      parts_status: ["pending", "confirmed", "not_required"],
      payment_method: ["cash", "check", "bank_transfer", "online"],
      quotation_line_type: ["parts", "labor", "transport", "other"],
      quotation_status: ["draft", "sent", "accepted", "rejected", "expired"],
      report_review_status: ["draft", "submitted", "approved", "returned"],
      requisition_status: ["pending", "approved", "rejected", "fulfilled"],
      reservation_status: ["reserved", "released", "consumed"],
    },
  },
} as const
