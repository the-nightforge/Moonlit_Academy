-- Aseprite alignment of inspected physical flower landmarks, never cloth bounding boxes.
local root=assert(app.params.root,"Pass root")
local function path(p)return app.fs.joinPath(root,p)end
local file=assert(io.open(path("docs/assets/silk-landmarks.json"),"r"))
local samples=json.decode(file:read("*a")).samples;file:close()
for _,sample in ipairs(samples)do
  local filename="art/animations/"..sample.stem..".aseprite"
  local sprite=Sprite{fromFile=path(filename)}
  local valid,info=pcall(json.decode,sprite.data)
  if valid and info and info.alignment=="flower" and info.revision==2 then
    print(sample.stem.." already stabilized");sprite:close()
  else
    local before="art/animations/references/"..sample.stem.."-before-stabilization.aseprite"
    if valid and info and info.alignment=="flower" then sprite:close();sprite=Sprite{fromFile=path(before)}end
    assert(#sprite.frames==#sample.anchors,"Flower landmark count mismatch")
    local images,anchors={},{}
    local minX,minY,maxX,maxY=0,0,0,0
    local reference=sample.anchors[sample.peak+1]
    for index,anchor in ipairs(sample.anchors)do
      local image=Image(sprite.width,sprite.height,ColorMode.RGB);image:drawSprite(sprite,index)
      local visible=0
      for pixel in image:pixels(Rectangle(anchor[1]-16,anchor[2]-16,33,33))do
        local color=pixel()
        if app.pixelColor.rgbaA(color)>=128 and app.pixelColor.rgbaR(color)>=160 and app.pixelColor.rgbaG(color)>=160 and app.pixelColor.rgbaB(color)>=160 then visible=visible+1 end
      end
      assert(visible>=50,"Marked flower has insufficient illustrated petals")
      images[index]=image;anchors[index]={x=anchor[1],y=anchor[2]}
      local dx,dy=reference[1]-anchor[1],reference[2]-anchor[2]
      minX=math.min(minX,dx);minY=math.min(minY,dy);maxX=math.max(maxX,dx);maxY=math.max(maxY,dy)
    end
    local width,height=sprite.width+maxX-minX,sprite.height+maxY-minY
    local aligned={}
    for index,image in ipairs(images)do
      local result=Image(width,height,ColorMode.RGB)
      result:drawImage(image,Point(reference[1]-anchors[index].x-minX,reference[2]-anchors[index].y-minY))
      aligned[index]=result
    end
    local feature={x=reference[1]-minX,y=reference[2]-minY}
    local stable=Sprite(width,height,ColorMode.RGB)
    stable.layers[1].name="Illustrated flower, silk and petals"
    for index,image in ipairs(aligned)do
      if index>1 then stable:newEmptyFrame()end
      stable:newCel(stable.layers[1],index,image,Point(0,0))
      stable.frames[index].duration=sprite.frames[index].duration
      local actual=Image(width,height,ColorMode.RGB);actual:drawSprite(stable,index)
      assert(actual:isEqual(image),"Alignment changed the illustrated pixels")
    end
    for _,tag in ipairs(sprite.tags)do stable:newTag(tag.fromFrame.frameNumber,tag.toFrame.frameNumber).name=tag.name end
    local origin={x=-minX,y=-minY}
    local pivot={x=origin.x+sprite.width/2,y=origin.y+sprite.height/2}
    local slice=stable:newSlice(Rectangle(origin.x,origin.y,sprite.width,sprite.height))
    slice.name="presentation";slice.pivot=Point(sprite.width/2,sprite.height/2)
    stable.data=json.encode{alignment="flower",revision=2,anchor=pivot,featureAnchor=feature,sourcePixelsPreserved=true,
      originalCanvas={w=sprite.width,h=sprite.height},sourceAnchors=anchors}
    if not app.fs.isFile(path(before))then sprite:saveCopyAs(path(before))end
    stable:saveAs(path(filename));stable:close();sprite:close()
    print(sample.stem..": aligned flower; source pixels preserved; padded canvas "..width.."x"..height)
  end
end
