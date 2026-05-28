import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HistoryEntry } from '../types';

export const generatePDFAndShare = async (
  item: Pick<
    HistoryEntry,
    | 'student'
    | 'objective'
    | 'durationWeeks'
    | 'weight'
    | 'height'
    | 'imc'
    | 'clinicalNotes'
    | 'workoutData'
  >,
  onlyDownload: boolean = false,
  exerciseLibrary: any[] = []
) => {
  const { student, objective, durationWeeks, weight, height, imc, clinicalNotes, workoutData } = item;
  
  if (!workoutData || !workoutData.days) return;

  const doc = new jsPDF();
  
  let profile = {
    name: 'Treinador',
    instagram: '',
    whatsapp: '',
    logoUrl: '',
    pdfTemplate: '1'
  };
  
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('elite_coach_profile');
    if (saved) {
      try {
        profile = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing profile configuration', e);
      }
    }
  }
  
  const isDark = profile.pdfTemplate === '2';
  
  // Page bg
  if (isDark) {
    doc.setFillColor(24, 24, 27); // zinc-900
    doc.rect(0, 0, 210, 297, 'F');
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text((profile.name || 'Treinador').toUpperCase() + " - PROTOCOLO DE TREINO", 14, 22);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(isDark ? 200 : 50, isDark ? 200 : 50, isDark ? 200 : 50);
  
  const startY = 32;
  doc.text(`Aluno:`, 14, startY); 
  doc.setFont("helvetica", "normal"); 
  doc.text(student, 30, startY);
  
  doc.setFont("helvetica", "bold"); 
  doc.text(`Objetivo:`, 14, startY + 6); 
  doc.setFont("helvetica", "normal"); 
  doc.text(objective, 35, startY + 6);
  
  doc.setFont("helvetica", "bold"); 
  doc.text(`Duração:`, 14, startY + 12); 
  doc.setFont("helvetica", "normal"); 
  doc.text(`${durationWeeks} semanas`, 35, startY + 12);
  
  // Novas informações do aluno
  doc.setFont("helvetica", "bold"); 
  doc.text(`Físico:`, 100, startY); 
  doc.setFont("helvetica", "normal"); 
  doc.text(`Peso: ${weight || '-'} kg | Alt: ${height || '-'} cm | IMC: ${imc || '-'}`, 118, startY);
  
  doc.setFont("helvetica", "bold"); 
  doc.text(`Clínico:`, 100, startY + 6); 
  doc.setFont("helvetica", "normal"); 
  doc.text(clinicalNotes || '-', 118, startY + 6, { maxWidth: 80 });
  
  let yPos = startY + 24;

  workoutData.days.forEach((dayItem: any) => {
     doc.setFont("helvetica", "bold");
     doc.setFontSize(14);
     doc.setTextColor(isDark ? 255 : 0, isDark ? 255 : 0, isDark ? 255 : 0);
     doc.text(dayItem.dayName, 14, yPos);
     
     const tableData = dayItem.exercises.map((ex: any) => {
       const match = exerciseLibrary && exerciseLibrary.find(
         (libEx: any) => libEx.name.toLowerCase().trim() === ex.name.toLowerCase().trim() && libEx.video_url
       );
       const cellName = match
         ? { content: `${ex.name} 🎥`, styles: { textColor: [212, 175, 55] as [number, number, number], fontStyle: 'bold' as const } }
         : ex.name;
       return [cellName, ex.sets, ex.reps, ex.rest, ex.notes || '-'];
     });

     autoTable(doc, {
       startY: yPos + 4,
       head: [['Exercício', 'Séries', 'Reps', 'Descanso', 'Notas']],
       body: tableData,
       theme: isDark ? 'grid' : 'grid',
       headStyles: { fillColor: isDark ? [40, 40, 40] : [212, 175, 55], textColor: isDark ? [212, 175, 55] : [0,0,0], fontStyle: 'bold' },
       styles: { fontSize: 10, cellPadding: 4, textColor: isDark ? [220, 220, 220] : [40, 40, 40], fillColor: isDark ? [30, 30, 30] : [255, 255, 255] },
       alternateRowStyles: { fillColor: isDark ? [40, 40, 40] : [250, 248, 239] },
       didDrawCell: (data) => {
         if (data.row.section === 'body' && data.column.index === 0) {
           const cellText = data.cell.text.join(' ');
           if (cellText.includes('🎥')) {
             const cleanName = cellText.replace('🎥', '').trim();
             const match = exerciseLibrary && exerciseLibrary.find(
               (libEx: any) => libEx.name.toLowerCase().trim() === cleanName.toLowerCase() && libEx.video_url
             );
             if (match && match.video_url) {
               doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: match.video_url });
             }
           }
         }
       }
     });
     
     yPos = (doc as any).lastAutoTable.finalY + 15;
     if (yPos > 270) {
       doc.addPage();
       if (isDark) { doc.setFillColor(24, 24, 27); doc.rect(0, 0, 210, 297, 'F'); }
       yPos = 20;
     }
  });
  
  // Add Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    let footerText = `Personal: ${profile.name}`;
    if (profile.instagram) footerText += `  |  Instagram: ${profile.instagram}`;
    if (profile.whatsapp) footerText += `  |  WhatsApp: ${profile.whatsapp}`;
    
    const pageWidth = doc.internal.pageSize.width;
    const textWidth = doc.getStringUnitWidth(footerText) * doc.getFontSize() / doc.internal.scaleFactor;
    const textOffset = (pageWidth - textWidth) / 2;
    doc.text(footerText, textOffset, 290);
  }

  if (onlyDownload) {
     doc.save(`Protocolo_${student.replace(/ /g, '_')}.pdf`);
     return;
  }

  let workoutText = `*PLANILHA DE TREINO (Elite Coach Premium)*\n👤 Aluno: ${student}\n🎯 Objetivo: ${objective}\n\n`;
  if (workoutData && workoutData.days) {
    workoutData.days.forEach((day: any) => {
       workoutText += `*${day.dayName}*\n`;
       day.exercises.forEach((ex: any) => {
          const match = exerciseLibrary && exerciseLibrary.find(
            (libEx: any) => libEx.name.toLowerCase().trim() === ex.name.toLowerCase().trim() && libEx.video_url
          );
          workoutText += `• ${ex.name} | ${ex.sets}x${ex.reps} | ⏱️ ${ex.rest}`;
          if (match && match.video_url) {
             workoutText += ` | 🎥 Vídeo: ${match.video_url}`;
          }
          workoutText += `\n`;
          if (ex.notes) workoutText += `   _${ex.notes}_\n`;
       });
       workoutText += `\n`;
    });
  }

  let filesArray: File[] = [];
  try {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], `Protocolo_${student.replace(/ /g, '_')}.pdf`, { type: 'application/pdf' });
      filesArray.push(file);
  } catch (e) {
      console.error("Could not generate PDF for sharing:", e);
  }
  
  if (navigator.share) {
    try {
      if (navigator.canShare && navigator.canShare({ files: filesArray })) {
        await navigator.share({
          title: 'Planilha de Treino',
          text: workoutText,
          files: filesArray
        });
      } else {
        await navigator.share({
          title: 'Planilha de Treino',
          text: workoutText,
        });
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(workoutText)}`, '_blank');
  }
};
