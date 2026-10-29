export function powerLetterPeople(id){
 if(!['carta-poder-cfe','carta-poder-japac'].includes(id))return null;
 return [['seller','Otorgante'],['buyer','Autorizado'],...(id==='carta-poder-cfe'?[['witness1','Testigo 1'],['witness2','Testigo 2']]:[])];
}
