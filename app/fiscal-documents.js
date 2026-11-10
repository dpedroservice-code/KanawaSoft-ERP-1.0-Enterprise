/* Kanawa Soft ERP — fiscal document primitives.
 * This module validates and snapshots document data; it does not certify AGT compliance.
 * Rates must come from the company's effective tax rules or an explicit product rule.
 */
(function(global){
  'use strict';
  const TYPES=Object.freeze({
    FT:{label:'Fatura',fiscal:true,createsReceivable:true},
    FR:{label:'Fatura-Recibo',fiscal:true,createsReceivable:false},
    RE:{label:'Recibo',fiscal:true,createsReceivable:false},
    PP:{label:'Fatura Proforma',fiscal:false,createsReceivable:false},
    NC:{label:'Nota de Crédito',fiscal:true,createsReceivable:false}
  });
  const round=value=>Math.round((Number(value)||0)*100+Number.EPSILON)/100;
  const rate=value=>{
    const n=Number(value);
    if(!Number.isFinite(n)||n<0||n>100) throw new Error('Taxa de imposto inválida. Use uma percentagem entre 0 e 100.');
    return n>1?n/100:n;
  };
  function calculateLines(items,options){
    const opts=options||{},discount= Math.max(0,Math.min(100,Number(opts.discountPercent)||0));
    const rows=Array.isArray(items)?items:[];
    if(!rows.length) throw new Error('Adicione pelo menos um artigo ao documento.');
    const subtotal=round(rows.reduce((sum,item)=>sum+Math.max(0,Number(item.unitPrice??item.preco)||0)*Math.max(0,Number(item.quantity??item.qty)||0),0));
    const discountTotal=round(subtotal*discount/100);
    let allocatedDiscount=0,taxTotal=0,baseTotal=0;
    const lines=rows.map((item,index)=>{
      const quantity=Number(item.quantity??item.qty)||0,unitPrice=Number(item.unitPrice??item.preco)||0;
      if(quantity<=0||unitPrice<0) throw new Error('Quantidade e preço inválidos na linha '+(index+1)+'.');
      const lineGross=round(quantity*unitPrice);
      const lineDiscount=index===rows.length-1?round(discountTotal-allocatedDiscount):round(subtotal?discountTotal*lineGross/subtotal:0);
      allocatedDiscount=round(allocatedDiscount+lineDiscount);
      const taxableBase=round(lineGross-lineDiscount);
      const taxRate=opts.applyTax===false?0:rate(item.taxRate??item.taxaIVA??opts.defaultRate??0);
      const exemptionReason=String(item.exemptionReason??item.motivoIsencaoIVA??'').trim();
      if(opts.applyTax!==false&&taxRate===0&&item.taxExempt===true&&!exemptionReason){
        throw new Error('Indique o fundamento de isenção de imposto na linha '+(index+1)+'.');
      }
      const taxAmount=round(taxableBase*taxRate);
      baseTotal=round(baseTotal+taxableBase);taxTotal=round(taxTotal+taxAmount);
      return Object.assign({},item,{
        quantity,unitPrice,lineGross,discountValue:lineDiscount,taxableBase,
        taxRate:round(taxRate*100),taxAmount,exemptionReason,
        unitOfMeasure:String(item.unitOfMeasure??item.unidade??'UN'),
        productCode:String(item.productCode??item.codigo??item.codigoBarras??'')
      });
    });
    return {subtotal,discountValue:discountTotal,taxableBase:baseTotal,taxAmount:taxTotal,total:round(baseTotal+taxTotal),lines};
  }
  function validateDocument(input){
    const doc=input||{},type=String(doc.documentType||doc.tipoDocumento||'').toUpperCase();
    if(!TYPES[type]) throw new Error('Tipo de documento não suportado.');
    if(type==='PP'&&doc.issueFiscal===true) throw new Error('A proforma é comercial e não pode ser emitida como documento fiscal.');
    if(['FT','FR'].includes(type)){
      if(!doc.number||!new RegExp('^'+type+'-\\d{4}-\\d{6}$').test(String(doc.number))) throw new Error('Número sequencial inválido para '+type+'.');
      if(!doc.issuer||!String(doc.issuer.taxId||doc.issuer.nif||'').trim()) throw new Error('Configure o NIF do emitente antes de emitir o documento.');
      if(type==='FT'&&doc.customer&&doc.customer.isCompany&&!String(doc.customer.address||'').trim()) throw new Error('O endereço do cliente empresarial é obrigatório para a FT.');
    }
    return {type,label:TYPES[type].label,fiscal:TYPES[type].fiscal};
  }
  function label(type){return (TYPES[String(type||'').toUpperCase()]||{}).label||'Documento comercial';}
  function snapshot(sale,issuer){
    const type=String(sale.tipoDocumento||sale.documentType||'').toUpperCase();
    const totals=calculateLines((sale.itens||[]).map(item=>Object.assign({},item,{
      unitPrice:item.preco,quantity:item.qty,taxRate:item.taxRate??item.taxaIVA??sale.taxRate,
      exemptionReason:item.exemptionReason??item.motivoIsencaoIVA
    })),{discountPercent:0,defaultRate:sale.taxRate,applyTax:sale.aplicarIVA!==false});
    return Object.freeze({
      documentType:type,number:String(sale.numeroFatura||''),issuedAt:String(sale.data||new Date().toISOString()),
      issuer:Object.assign({},issuer||sale.empresa||{}),
      customer:{name:sale.clienteNome||'Consumidor Final',taxId:sale.clienteNif||'999999999',address:sale.clienteEndereco||''},
      taxRegime:sale.regime||'not_configured',lines:totals.lines,
      subtotal:round(sale.subtotal),discountValue:round(sale.descontoValor),taxableBase:round(sale.baseIncidencia??totals.taxableBase),
      taxAmount:round(sale.iva),total:round(sale.total),currency:'AOA',
      certificationStatus:'not_certified'
    });
  }
  global.KanawaFiscalDocuments=Object.freeze({TYPES,calculateLines,validateDocument,label,snapshot,round});
})(window);
