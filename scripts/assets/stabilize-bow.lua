-- Aseprite-only alignment: find the same bright arrowhead feature, never bounding-box centers.
local root=assert(app.params.root,"Pass root")
local function path(p)return app.fs.joinPath(root,p)end
local sprite=Sprite{fromFile=path("art/animations/combat_attack_bow_flow.aseprite")}
local valid,info=pcall(json.decode,sprite.data)
if valid and info and info.alignment=="arrowhead" and info.revision==2 then
  print("Bow is already stabilized; export the saved source.");sprite:close();return
end
local before="art/animations/references/combat_attack_bow_flow-before-stabilization.aseprite"
if valid and info and info.alignment=="arrowhead" then sprite:close();sprite=Sprite{fromFile=path(before)}end
local images,anchors={},{}
for index=1,#sprite.frames do
  local image=Image(sprite.width,sprite.height,ColorMode.RGB);image:drawSprite(sprite,index)
  local right=-1
  local function head(pixel)
    local color=pixel()
    return pixel.x>sprite.width*.72 and app.pixelColor.rgbaA(color)>=128
      and app.pixelColor.rgbaR(color)>=180 and app.pixelColor.rgbaG(color)>=180 and app.pixelColor.rgbaB(color)>=145
  end
  for pixel in image:pixels()do if head(pixel)then right=math.max(right,pixel.x)end end
  local sum,count=0,0
  for pixel in image:pixels()do if head(pixel) and pixel.x>=right-2 then sum=sum+pixel.y;count=count+1 end end
  assert(count>0,"Arrowhead feature missing")
  images[index]=image;anchors[index]={x=right,y=math.floor(sum/count+.5)}
end
local reference=anchors[10]
local minX,minY,maxX,maxY=0,0,0,0
for _,anchor in ipairs(anchors)do
  local dx,dy=reference.x-anchor.x,reference.y-anchor.y
  minX=math.min(minX,dx);minY=math.min(minY,dy);maxX=math.max(maxX,dx);maxY=math.max(maxY,dy)
end
local width,height=sprite.width+maxX-minX,sprite.height+maxY-minY
local aligned={}
for index,image in ipairs(images)do
  local result=Image(width,height,ColorMode.RGB)
  result:drawImage(image,Point(reference.x-anchors[index].x-minX,reference.y-anchors[index].y-minY))
  aligned[index]=result
end
local pivot={x=reference.x-minX,y=reference.y-minY}
local coreX=pivot.x-100
local coreBounds={x=coreX,y=pivot.y-16,w=width-coreX,h=32}
local core=Image(aligned[10],Rectangle(coreBounds.x,coreBounds.y,coreBounds.w,coreBounds.h))
local stable=Sprite(width,height,ColorMode.RGB)
stable.layers[1].name="Illustrated feathers and wake"
local shaft=stable:newLayer();shaft.name="Rigid shaft and arrowhead"
for index,image in ipairs(aligned)do
  if index>1 then stable:newEmptyFrame()end
  local tail=Image(image)
  tail:clear(Rectangle(coreBounds.x,coreBounds.y,coreBounds.w,coreBounds.h))
  stable:newCel(stable.layers[1],index,tail,Point(0,0))
  stable:newCel(shaft,index,core,Point(coreBounds.x,coreBounds.y))
  stable.frames[index].duration=sprite.frames[index].duration
end
for _,tag in ipairs(sprite.tags)do stable:newTag(tag.fromFrame.frameNumber,tag.toFrame.frameNumber).name=tag.name end
local slice=stable:newSlice(Rectangle(0,0,width,height));slice.name="arrowhead";slice.pivot=Point(pivot.x,pivot.y)
stable.data=json.encode{alignment="arrowhead",revision=2,anchor=pivot,rigidCoreBounds=coreBounds,
  originalCanvas={w=sprite.width,h=sprite.height},sourceAnchors=anchors}
if not app.fs.isFile(path(before))then sprite:saveCopyAs(path(before))end
stable:saveAs(path("art/animations/combat_attack_bow_flow.aseprite"))
print("Aligned 20 arrowheads; padded canvas "..width.."x"..height.."; fixed core from x="..coreX)
stable:close();sprite:close()
