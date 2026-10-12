import { expect,it,vi } from 'vitest';
vi.stubGlobal('window',{devicePixelRatio:1,screen:{width:1280,height:720}});
const {roundedArtTexture}=await import('../src/ui/combat-card-view');
it.each([[300,900],[900,300],[300,300]])('rounded artwork contains the entire %sx%s source inside its border',(sw,sh)=>{
 const source={width:sw,height:sh},ctx={scale:vi.fn(),beginPath:vi.fn(),roundRect:vi.fn(),clip:vi.fn(),drawImage:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),strokeRect:vi.fn()};
 const scene:any={textures:{exists:(k:string)=>k==='art',get:()=>({getSourceImage:()=>source}),createCanvas:()=>({getContext:()=>ctx,refresh:vi.fn()})}};
 roundedArtTexture(scene,'art',144,92,6);
 const [image,x,y,w,h]=ctx.drawImage.mock.calls[0]!;
 expect(ctx.drawImage.mock.calls[0]).toHaveLength(5);expect(image).toBe(source);
 expect(w/h).toBeCloseTo(sw/sh);expect(x).toBeGreaterThanOrEqual(1);expect(y).toBeGreaterThanOrEqual(1);expect(x+w).toBeLessThanOrEqual(143);expect(y+h).toBeLessThanOrEqual(91);
 const [fx,fy,fw,fh]=ctx.strokeRect.mock.calls[0]??[];expect(fx).toBeCloseTo(x-.5);expect(fy).toBeCloseTo(y-.5);expect(fw).toBeCloseTo(w+1);expect(fh).toBeCloseTo(h+1);
});
