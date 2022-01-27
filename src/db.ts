import * as fs from 'fs';
export default (file: string): unknown=>{
    let db = {};
    let oldstr = "";
    if(fs.existsSync(file)){
        console.log("Reading "+file+"")
        try{
            db = JSON.parse(fs.readFileSync(file).toString());
        }catch(e){
            db = JSON.parse(fs.readFileSync(file+".bak").toString());
        }
    }else if(fs.existsSync(file+".bak")){
        fs.renameSync(file+".bak", file);
        db = JSON.parse(fs.readFileSync(file+".bak").toString());
    }else{
        console.log("Creating "+file+"")
    }
    setInterval(()=>{
        let str = JSON.stringify(db);
        if(oldstr!=str){
            oldstr = str;
            try{
                fs.rmSync(file+".bak");
            }catch(e){}
            fs.writeFileSync(file+".bak", str)
            try{
                fs.rmSync(file);
            }catch(e){}
            fs.renameSync(file+".bak", file);
        }
    },30000);
    return db;
}