const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://josasxfmoilaqscfkkpw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvc2FzeGZtb2lsYXFzY2Zra3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjU3NTYsImV4cCI6MjA5NTUwMTc1Nn0.i6LvYNe814Dk7en49w0bhDk57vZxoZ79V1H4tDgjGvA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Let's try to insert a dummy row and see what columns are in the response
  const { data, error } = await supabase
    .from('notifications')
    .insert([{
      title: 'Test Title',
      message: 'Test Message',
      type: 'info'
    }])
    .select('*');
  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Inserted row columns:', Object.keys(data[0]), data);
    // Delete the test row
    await supabase.from('notifications').delete().eq('id', data[0].id);
  }
}
run();
