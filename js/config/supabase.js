// Configuration Supabase
const SUPABASE_URL = 'https://iprxvglhqbiowxxqefgs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwcnh2Z2xocWJpb3d4eHFlZmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTQzMzAsImV4cCI6MjA5NzM5MDMzMH0.8InQkkXWPZJHIQb6wkqaQh1XHHEeHhwk95V1aBH5Fvc';

// Client Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
