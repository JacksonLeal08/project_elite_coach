import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HistoryEntry, Student, Anamnesis, StudentGoal } from '../types';

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

export const exportAnamnesisPDF = async (student: Student, anamnesis: Anamnesis | null) => {
  const doc = new jsPDF();
  
  // Header Config (Premium Dark-Gold)
  doc.setFillColor(10, 20, 16); // surface: #0a1410
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text("ELITE COACH", 14, 25);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("FICHA CLÍNICA & ANAMNESE", 14, 32);
  
  // Divider
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(14, 36, 196, 36);
  
  // Student basic info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("ALUNO:", 14, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`${student.name} (${student.age} anos)`, 32, 45);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("OBJETIVO:", 110, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(student.goal, 132, 45);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("BIOTIPO:", 14, 51);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(student.biotype, 32, 51);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("STATUS:", 110, 51);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(212, 175, 55);
  doc.text(student.status, 132, 51);
  
  // Divider
  doc.setDrawColor(34, 66, 51);
  doc.line(14, 56, 196, 56);
  
  const anamnesisData = [
    ["Restrições Médicas / Lesões", anamnesis?.medical_restrictions || "Nenhuma declarada"],
    ["Histórico Cirúrgico", anamnesis?.surgical_history || "Nenhum informado"],
    ["Condição Cardiovascular", anamnesis?.cardio_condition || "Normal"],
    ["Medicamentos em Uso", anamnesis?.medications || "Nenhum"],
    ["Hábitos Alimentares / Alergias", anamnesis?.dietary_habits || "Nenhum"],
    ["Consumo Diário de Água", `${anamnesis?.water_intake || 2.0} Litros`],
    ["Nível de Flexibilidade", anamnesis?.flexibility_level || "Médio"]
  ];
  
  autoTable(doc, {
    startY: 62,
    head: [['Campo de Análise', 'Detalhes Clínicos']],
    body: anamnesisData,
    theme: 'grid',
    headStyles: { fillColor: [26, 52, 40], textColor: [212, 175, 55], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 6, textColor: [220, 220, 220], fillColor: [18, 36, 28] },
    alternateRowStyles: { fillColor: [10, 20, 16] },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold', textColor: [212, 175, 55] },
      1: { cellWidth: 122 }
    }
  });
  
  // Add signature section at the bottom
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  doc.setDrawColor(100, 100, 100);
  doc.line(14, finalY, 90, finalY);
  doc.line(120, finalY, 196, finalY);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("Assinatura do Treinador", 35, finalY + 5);
  doc.text("Assinatura do Aluno", 145, finalY + 5);
  
  doc.save(`Anamnese_${student.name.replace(/ /g, '_')}.pdf`);
};

export const exportPosturePDF = async (student: Student) => {
  const doc = new jsPDF();
  
  doc.setFillColor(10, 20, 16); // surface: #0a1410
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text("ELITE COACH", 14, 25);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("AVALIAÇÃO POSTURAL MULTI-ÂNGULO", 14, 32);
  
  // Divider
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(14, 36, 196, 36);
  
  // Student basic info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("ALUNO:", 14, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`${student.name} (${student.age} anos)`, 32, 45);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("DATA DO LAUDO:", 120, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(new Date().toLocaleDateString('pt-BR'), 155, 45);
  
  // Photos container
  const imgY = 55;
  const imgW = 55;
  const imgH = 75;
  const spacing = 7;
  
  const angles: Array<{ key: keyof Student; label: string; x: number }> = [
    { key: 'photo_front_url', label: 'Vista Frontal', x: 14 },
    { key: 'photo_back_url', label: 'Vista Traseira', x: 14 + imgW + spacing },
    { key: 'photo_side_url', label: 'Vista Lateral', x: 14 + (imgW + spacing) * 2 }
  ];
  
  angles.forEach((angle) => {
    const photoData = student[angle.key] as string;
    
    // Label above image
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(212, 175, 55);
    doc.text(angle.label, angle.x + (imgW / 2) - 10, imgY - 4);
    
    if (photoData && photoData.startsWith('data:image/')) {
      try {
        // Embed Base64 image
        doc.addImage(photoData, 'PNG', angle.x, imgY, imgW, imgH);
      } catch (err) {
        console.error(`Error adding ${angle.label} image to PDF:`, err);
        // Draw fallback placeholder
        doc.setFillColor(26, 36, 32);
        doc.rect(angle.x, imgY, imgW, imgH, 'F');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Erro ao carregar", angle.x + 12, imgY + (imgH / 2));
      }
    } else {
      // Draw placeholder
      doc.setFillColor(18, 36, 28);
      doc.rect(angle.x, imgY, imgW, imgH, 'F');
      
      // Draw border
      doc.setDrawColor(34, 66, 51);
      doc.setLineWidth(0.5);
      doc.rect(angle.x, imgY, imgW, imgH, 'S');
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 120, 110);
      doc.text("Foto não cadastrada", angle.x + 12, imgY + (imgH / 2));
    }
  });
  
  // Observações Posturais section
  const notesY = imgY + imgH + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(212, 175, 55);
  doc.text("ANÁLISE E OBSERVAÇÕES POSTURAIS", 14, notesY);
  
  doc.setDrawColor(34, 66, 51);
  doc.line(14, notesY + 3, 196, notesY + 3);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 220, 220);
  const defaultNotes = "O laudo postural acima permite a calibragem da grade de referência para identificação de possíveis desvios osteomioarticulares (como escoliose, hipercifose, hiperlordose ou valgo de joelhos). O treinador utilizará estas referências visuais para individualizar a seleção de exercícios e dosar o volume de treinos clínicos.";
  doc.text(defaultNotes, 14, notesY + 10, { maxWidth: 182 });
  
  // Footer
  const footerY = notesY + 55;
  doc.setDrawColor(100, 100, 100);
  doc.line(60, footerY, 150, footerY);
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Assinatura e Carimbo do Avaliador", 85, footerY + 5);
  
  doc.save(`Laudo_Postural_${student.name.replace(/ /g, '_')}.pdf`);
};

export const exportEvolutionPDF = async (student: Student, evaluations: any[], goals: StudentGoal | null) => {
  const doc = new jsPDF();
  
  doc.setFillColor(10, 20, 16); // surface: #0a1410
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text("ELITE COACH", 14, 25);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("RELATÓRIO DE EVOLUÇÃO CORPORAL & METAS", 14, 32);
  
  // Divider
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(14, 36, 196, 36);
  
  // Student basic info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("ALUNO:", 14, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`${student.name} (${student.age} anos)`, 32, 45);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 180, 180);
  doc.text("OBJETIVO:", 110, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(student.goal, 132, 45);
  
  // Comparative Goals Grid
  doc.setFillColor(18, 36, 28);
  doc.rect(14, 52, 182, 30, 'F');
  doc.setDrawColor(34, 66, 51);
  doc.rect(14, 52, 182, 30, 'S');
  
  // Text inside goals box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(212, 175, 55);
  doc.text("METAS CORPORAIS DEFINIDAS:", 18, 59);
  
  const wTarget = goals?.weight_target ? `${goals.weight_target} kg` : '-';
  const fTarget = goals?.body_fat_target ? `${goals.body_fat_target}%` : '-';
  const mTarget = goals?.muscle_target ? `${goals.muscle_target} kg` : '-';
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`Peso Alvo: ${wTarget}`, 18, 70);
  doc.text(`Gordura Alvo: ${fTarget}`, 65, 70);
  doc.text(`Massa Muscular Alvo: ${mTarget}`, 115, 70);
  
  // Prepare Table Data (Sort by date ascending)
  const sortedEvals = [...evaluations].sort((a,b) => {
    const dA = a.date ? new Date(a.date) : new Date(a.created_at || '');
    const dB = b.date ? new Date(b.date) : new Date(b.created_at || '');
    return dA.getTime() - dB.getTime();
  });
  
  const tableData = sortedEvals.map((e) => {
    const d = e.date ? new Date(e.date) : new Date(e.created_at || '');
    const dateStr = d.toLocaleDateString('pt-BR');
    return [
      dateStr,
      e.weight ? `${e.weight} kg` : '-',
      e.body_fat ? `${e.body_fat}%` : '-',
      e.skeletal_muscle ? `${e.skeletal_muscle} kg` : '-',
      e.heart_rate ? `${e.heart_rate} BPM` : '-',
      e.energy ? `${e.energy}/10` : '-',
      e.sleep ? `${e.sleep}/10` : '-'
    ];
  });
  
  autoTable(doc, {
    startY: 92,
    head: [['Data', 'Peso (kg)', 'Gordura (%)', 'Massa Muscular (kg)', 'FC (BPM)', 'Energia', 'Sono']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [26, 52, 40], textColor: [212, 175, 55], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 5, textColor: [220, 220, 220], fillColor: [18, 36, 28] },
    alternateRowStyles: { fillColor: [10, 20, 16] }
  });
  
  doc.save(`Evolucao_${student.name.replace(/ /g, '_')}.pdf`);
};
